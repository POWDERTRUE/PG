# DockingModeController — Design Specification

> **Runtime system:** OMEGA V31 · Powder Galaxy Visual OS  
> **Layer:** Input Subsystem — Interaction Arbitration Layer  
> **Spec version:** 1.0  
> **Status:** `PLANNED` — Milestone after `v1.0.0-input-subsystem`  
> **Target file:** `frontend/src/engine/input/DockingModeController.js`

---

## 1. Purpose

Defines the **orbital proximity docking interaction controller** responsible for safe approach arbitration
and capture-envelope alignment under scheduler authority.

This controller introduces **constraint-driven navigation** to the OMEGA V31 runtime — the first mode
where `Flight ≠ free navigation`. Instead, the flight envelope is progressively restricted by distance,
velocity, and angular alignment constraints as the player approaches a docking target.

`DockingModeController` is also the **first production validation** of `InputPriorityStack` as a true
OS-class scheduler — proving the stack handles multi-subsystem authority beyond the single HUD toggle case.

### Integration points

| Dependency | Role |
|---|---|
| `InputPriorityStack` | Scheduler authority — `push("DOCKING")` / `pop()` |
| `UniverseNavigationSystem` | Receives constraint overrides; does not get replaced |
| `TargetTrackingSystem` | Provides relative position + orientation of docking target |
| `EventBus` (`runtimeSignals`) | All state transitions are event-driven |
| `UniverseKernel` | Boot pipeline registration |

---

## 2. FSM Definition

### States

| State | Description |
|---|---|
| `IDLE` | Controller dormant. No scheduler authority. Normal flight. |
| `APPROACH` | Docking initiated. Velocity cap active. Full 6-DOF still allowed. |
| `ALIGNMENT` | Within alignment envelope. Rotation constrained to alignment cone. |
| `LOCK` | Within capture envelope. Translation damped to near-zero. |
| `DOCKED` | Capture confirmed. Input authority suspended. Player attached to target. |
| `ABORT` | Safety kill-switch. Any state → immediate Flight return. |

### State transition graph

```
IDLE
 └── PG:DOCKING:INITIATE
          ↓
     APPROACH           ← maxVelocity = 2.0 m/s
          ↓ distance < alignmentDistance (25 m)
     ALIGNMENT          ← maxVelocity = 0.5 m/s, alignmentCone = 5°
          ↓ angularError < maxAlignmentAngle AND distance < captureDistance (2 m)
       LOCK             ← translation damped, rotation locked to target axis
          ↓ capture confirmed (PG:DOCKING:CAPTURE)
      DOCKED            ← stack.pop(), player rigid to target

ABORT (from ANY state)
 ├── v_rel > safetyVelocityThreshold
 ├── PG:DOCKING:ABORT emitted externally
 └── Player manual escape (configurable keybind)
          ↓
       FLIGHT           ← stack.pop(), full navigation restored
```

---

## 3. Constraint Model

Constraints are **progressively applied** as the FSM advances — not toggled all-at-once.
Each transition narrows the flight envelope.

### 3.1 Distance Envelope

```
IDLE         → APPROACH     trigger: distance < activationDistance
APPROACH     → ALIGNMENT    trigger: distance < alignmentDistance
ALIGNMENT    → LOCK         trigger: distance < captureDistance
```

| Phase | Parameter | Value (reference) | Notes |
|---|---|---|---|
| Activation | `activationDistance` | `120 m` | Player must target object first |
| Alignment | `alignmentDistance` | `25 m` | Rotation constraint begins |
| Capture | `captureDistance` | `2 m` | Translation damped to zero |

> Values are descriptive defaults. Final tuning deferred to `NavigationConstants.js` or
> `DockingPortComponent` configuration per target.

### 3.2 Relative Velocity Constraint

```js
if (v_rel > safetyVelocityThreshold) {
    runtimeSignals.emit("PG:DOCKING:ABORT");
}
```

| Phase | `maxRelativeVelocity` |
|---|---|
| `APPROACH` | `2.0 m/s` |
| `ALIGNMENT` | `0.5 m/s` |
| `LOCK` | `0.05 m/s` |
| Safety abort | `> 3.0 m/s` (any state) |

### 3.3 Angular Alignment Cone

Measured using dot product of player forward vector vs. docking port forward vector:

```js
const alignment = playerForward.dot(dockingPortForward);
const angleRad  = Math.acos(Math.min(1.0, alignment));
const angleDeg  = angleRad * (180 / Math.PI);

if (angleDeg > maxAlignmentAngle) {
    // block LOCK transition
}
```

| Phase | `maxAlignmentAngle` |
|---|---|
| `ALIGNMENT` | `5°` |
| `LOCK` | `1°` |

---

## 4. Scheduler Integration

### Entering Docking Mode

```js
// Triggered by PG:DOCKING:INITIATE
enterDocking() {
    if (this.stack.current() === "DOCKING") return;
    this.stack.push("DOCKING");
    this.fsm.transition("APPROACH");
    this._applyConstraints("APPROACH");
}
```

### Exiting Docking Mode (normal completion)

```js
exitDocking() {
    this.navigationSystem.clearDockingConstraints();
    this.stack.pop(); // returns to previous state (FLIGHT or TARGETING)
    this.fsm.transition("IDLE");
}
```

### Abort path

```js
abort() {
    this.navigationSystem.clearDockingConstraints();
    this.stack.pop();
    this.fsm.transition("ABORT"); // → immediately transitions to IDLE
    this.runtimeSignals.emit("PG:DOCKING:ABORT");
}
```

> `stack.pop()` returns authority to whatever state was below `"DOCKING"` on the stack.
> This means abort from inside a `TARGETING → DOCKING` sequence correctly restores `TARGETING`,
> not `FLIGHT`.

### Stack state during a full docking sequence

```
Frame 0:    stack = ["FLIGHT"]
Frame 1:    stack = ["FLIGHT", "TARGETING"]       ← player locks target
Frame 2:    stack = ["FLIGHT", "TARGETING", "DOCKING"]  ← docking initiated
Frame 3:    DOCKED → stack.pop()                  ← ["FLIGHT", "TARGETING"]
```

---

## 5. Navigation Override Model

`DockingModeController` **does not replace** `UniverseNavigationSystem`.
It injects constraint parameters into it via a dedicated interface.

```js
navigationSystem.setDockingConstraints({
    maxVelocity:       2.0,   // m/s — phase-dependent, updated per transition
    alignmentCone:     5.0,   // degrees
    captureDistance:   2.0,   // m
    targetPosition:    vec3,  // updated every frame from TargetTrackingSystem
    targetForward:     vec3,
});

// On exit or abort:
navigationSystem.clearDockingConstraints();
```

**What docking overrides:**
- Free thrust translation magnitude (capped per phase)
- Camera drift (soft-locked toward docking port axis in `ALIGNMENT`+)
- Manual rotation speed (damped in `ALIGNMENT`, locked in `LOCK`)

**What docking never overrides:**
- `UniverseNavigationSystem` internal physics integrator (RK4 solver stays active)
- Pointer-lock state (managed by `InputStateSystem` — kernel authority preserved)
- `InputPriorityStack` authority of higher modes (HUD at priority 3 can still interrupt)

---

## 6. EventBus Contract

All state transitions are announced via `runtimeSignals` (EventBus). No polling.

### Inbound events (DockingModeController listens)

| Event | Trigger | Action |
|---|---|---|
| `PG:DOCKING:INITIATE` | External — player action, proximity sensor | `enterDocking()` |
| `PG:DOCKING:ABORT` | External or internal — velocity safety, UI | `abort()` |

### Outbound events (DockingModeController emits)

| Event | Emitted When | Consumer |
|---|---|---|
| `PG:DOCKING:APPROACH_READY` | FSM enters `APPROACH` | HUD approach indicator |
| `PG:DOCKING:ALIGNMENT_LOCK` | FSM enters `ALIGNMENT` | HUD alignment reticle |
| `PG:DOCKING:CAPTURE` | FSM enters `LOCK` (capture confirmed) | HUD capture ring, SFX |
| `PG:DOCKING:COMPLETE` | FSM enters `DOCKED` | HUD complete state, camera cinematic |
| `PG:DOCKING:ABORT` | `abort()` called | HUD abort flash, SFX, camera shake |

> Downstream consumers (HUD overlays, audio cues, magnetic capture visuals, camera automation)
> bind to these events independently — zero coupling to controller internals.

---

## 7. InputPriorityStack Mapping (complete tier table)

This release establishes the full priority table for the interaction arbitration layer:

| Priority | Mode | Authority Type | Controller |
|---|---|---|---|
| 0 | `FLIGHT` | Free navigation | `UniverseNavigationSystem` (default) |
| 1 | `TARGETING` | Tracking authority | `TargetTrackingSystem` |
| 2 | `DOCKING` | Constraint navigation | `DockingModeController` ← **this spec** |
| 3 | `HUD` | Interface overlay | `InteractionModeController` |
| 4 | `TERMINAL` | Command authority | `TerminalModeController` (future) |
| 5 | `CINEMATIC` | Script authority | `CinematicModeController` (future) |

`DOCKING` correctly slots between `TARGETING` (which must be active to initiate docking)
and `HUD` (which can overlay without aborting approach).

---

## 8. Implementation Skeleton

```js
// frontend/src/engine/input/DockingModeController.js

export class DockingModeController {
    constructor({ kernel, inputPriorityStack, navigationSystem, targetTrackingSystem }) {
        this.stack              = inputPriorityStack;
        this.navigationSystem   = navigationSystem;
        this.targetTracker      = targetTrackingSystem;
        this.runtimeSignals     = kernel?.runtimeSignals;

        this._state         = "IDLE";
        this._activeTarget  = null;

        this._registerListeners();
    }

    _registerListeners() {
        this.runtimeSignals?.on("PG:DOCKING:INITIATE", ({ target }) => {
            this._activeTarget = target;
            this.enterDocking();
        });
        this.runtimeSignals?.on("PG:DOCKING:ABORT", () => this.abort());
    }

    enterDocking() {
        if (this.stack.current() === "DOCKING") return;
        this.stack.push("DOCKING");
        this._transition("APPROACH");
    }

    update(dt) {
        if (this._state === "IDLE" || this._state === "DOCKED") return;

        const rel = this.targetTracker?.getRelativeState(this._activeTarget);
        if (!rel) return;

        // Abort check — runs every frame
        if (rel.velocity > SAFETY_VELOCITY_THRESHOLD) {
            this.abort();
            return;
        }

        // Progressive FSM advancement
        if (this._state === "APPROACH" && rel.distance < ALIGNMENT_DISTANCE) {
            this._transition("ALIGNMENT");
        }
        if (this._state === "ALIGNMENT"
            && rel.distance < CAPTURE_DISTANCE
            && rel.angularError < MAX_ALIGNMENT_ANGLE_RAD) {
            this._transition("LOCK");
        }
        if (this._state === "LOCK" && rel.captureConfirmed) {
            this._transition("DOCKED");
        }

        // Inject current-phase constraints
        this._applyConstraints(rel);
    }

    _transition(next) {
        this._state = next;
        const eventMap = {
            "APPROACH":  "PG:DOCKING:APPROACH_READY",
            "ALIGNMENT": "PG:DOCKING:ALIGNMENT_LOCK",
            "LOCK":      "PG:DOCKING:CAPTURE",
            "DOCKED":    "PG:DOCKING:COMPLETE",
        };
        if (eventMap[next]) this.runtimeSignals?.emit(eventMap[next]);
        if (next === "DOCKED") this.exitDocking();
    }

    _applyConstraints(rel) {
        const phase = CONSTRAINT_TABLE[this._state];
        if (!phase) return;
        this.navigationSystem.setDockingConstraints({
            maxVelocity:     phase.maxVelocity,
            alignmentCone:   phase.alignmentCone,
            captureDistance: CAPTURE_DISTANCE,
            targetPosition:  rel.position,
            targetForward:   rel.forward,
        });
    }

    exitDocking() {
        this.navigationSystem.clearDockingConstraints();
        this.stack.pop();
        this._state = "IDLE";
    }

    abort() {
        this.navigationSystem.clearDockingConstraints();
        this.stack.pop();
        this._state = "IDLE";
        this.runtimeSignals?.emit("PG:DOCKING:ABORT");
    }
}

// --- Constants ---

const ACTIVATION_DISTANCE        = 120;   // m
const ALIGNMENT_DISTANCE         = 25;    // m
const CAPTURE_DISTANCE           = 2;     // m
const SAFETY_VELOCITY_THRESHOLD  = 3.0;  // m/s — any state
const MAX_ALIGNMENT_ANGLE_RAD    = 5 * (Math.PI / 180); // 5°

const CONSTRAINT_TABLE = {
    APPROACH:  { maxVelocity: 2.0, alignmentCone: Infinity },
    ALIGNMENT: { maxVelocity: 0.5, alignmentCone: 5.0 },
    LOCK:      { maxVelocity: 0.05, alignmentCone: 1.0 },
};
```

---

## 9. Kernel Boot Integration

```js
// UniverseKernel.js — inside _registerSubsystems()

const dockingController = new DockingModeController({
    kernel:               this,
    inputPriorityStack:   Registry.get("inputPriorityStack"),
    navigationSystem:     Registry.get("navigationSystem"),
    targetTrackingSystem: Registry.get("targetTrackingSystem"),
});

Registry.register("dockingModeController", dockingController);
```

The controller's `update(dt)` must be called from the kernel loop, or from
`UniverseNavigationSystem.update()` if proximity logic lives there.

---

## 10. CSS Execution Layer

Following the pattern established by `pg-hud-mode`, docking mode exposes body-class hooks
for the styling layer:

```css
/* Added by DockingModeController on enterDocking() */
body.pg-docking-mode .hud-docking-overlay { display: block; }
body.pg-docking-mode .hud-crosshair        { opacity: 0;     }

body.pg-docking-approach  .docking-distance-ring { opacity: 1; }
body.pg-docking-alignment .docking-align-reticle  { opacity: 1; }
body.pg-docking-lock      .docking-capture-ring   { opacity: 1; }
```

Logic authority (JS) and visual execution (CSS) remain separated by kernel design law.

---

## 11. Roadmap — Milestone Classification

| Release | Milestone | Status |
|---|---|---|
| `v1.0.0-input-subsystem` | Interaction Arbitration Layer v1.0 | ✅ Released |
| `v1.5.0-docking-subsystem` | **Docking FSM Controller v1.0** | 🔜 This spec |
| `v1.6.0-terminal-subsystem` | Terminal Mode Controller | ⬜ Future |
| `v2.0.0-cinematic-subsystem` | Cinematic Mode Controller (FSM + rail scripting) | ⬜ Future |

After `DockingModeController` ships, the stack will have been validated across three distinct
authority types (free, overlay, constrained), confirming `InputPriorityStack` as a production-grade
OS-class scheduler. Version bump to **Visual OS Runtime Interaction Layer v1.5** is appropriate.

---

*Powder Galaxy · OMEGA V31 · Visual OS Runtime · DockingModeController Design Spec v1.0*
