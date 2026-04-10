# Skill Audit

Date: 2026-04-07
Scope: Repo-local Powder Galaxy skills and the specialized Powder Galaxy migration skill in the local Codex skill store
Mode: Audit and design only. No skill decomposition implemented yet.

## Current Skill Surface

| Skill | Path | Scope | State | Notes |
| --- | --- | --- | --- | --- |
| `lulu-engine-architect-skill` | `C:/xampp/htdocs/Powder_Galaxy/.github/skills/powder-galaxy/SKILL.md` | Repo-wide architecture guide | Active | Good as a master skill, but still broad for focused use. |
| `migrate-powder-galaxy-phase-2` | `C:/Users/miger/.codex/skills/migrate-powder-galaxy-phase-2/SKILL.md` | Explorer migration / CelestialBody / MaterialRegistry | Active | Focused and useful; already aligned to REGLA 8, LEY 15, and REGLA 19. |

## What Is Working

- The repo now has a clean, valid master skill with references and UI metadata.
- The Phase 2 migration skill is narrow enough to be reusable and auditable.
- Both skills passed `quick_validate.py`.
- The repo skill now points engineers toward live sources such as `UniverseKernel.js`, `UNIVERSE_LAWS.md`, and `ALBUM_UNIVERSAL`.

## Current Weaknesses

### 1. The master skill is still doing too much

The repo skill is still the only local skill for:

- boot debugging
- Zero-GC audits
- physics and mass-system rules
- rendering/material registry work
- HUD/window integration
- navigation and camera issues

This means the trigger can fire for many unrelated tasks and bring in more context than needed.

### 2. The repo has drift, but the skill layer does not yet model that drift explicitly

The codebase currently has multiple alternate implementations for core concepts such as:

- `SpatialIndexSystem`
- `FloatingOriginSystem`
- `MaterialRegistry`
- `WindowManager`

The skill should route engineers toward canonical paths only and treat alternate paths as legacy or archived candidates.

### 3. There is no dedicated audit skill for dead-code and dormant-subsystem analysis

Right now, the repo skill can guide a review, but there is no purpose-built skill that says:

- how to classify dead code vs dormant feature code
- how to verify registry-only subsystems
- how to batch cleanup safely without breaking runtime

## Recommended Target Skill Topology

Keep the master skill, then add narrow child skills for repeatable high-risk workflows.

| Proposed Skill | Purpose | Why It Should Exist |
| --- | --- | --- |
| `powder-galaxy-engine-core` | Master router for repo architecture | Preserve a single top-level entrypoint for broad engine work. |
| `powder-galaxy-boot-debug` | Boot failures, registry wiring, phase-order issues | Boot diagnostics are a distinct workflow with different source files and checks. |
| `powder-galaxy-zero-gc-audit` | REGLA 8 hot-path review and fixes | This deserves a highly focused checklist and command set. |
| `powder-galaxy-window-hud` | Window stack, HUD, DOM bridge, pointer mode | UI/window drift is now a separate problem domain. |
| `powder-galaxy-dead-code-audit` | Dead code, dormant systems, duplicate path consolidation | Gives cleanup work its own safe, evidence-driven procedure. |
| `powder-galaxy-planet-migration` | CelestialBody / MaterialRegistry / mass migration work | The current Phase 2 skill is a good seed for this. |

## Recommended Migration Path

### Phase A. Stabilize the master skill

- Rename or reposition it conceptually as the repo router.
- Keep it short.
- Make it point to child skills or references instead of trying to encode every workflow directly.

### Phase B. Extract the highest-value child skills

Start with the domains that are already generating architectural drag:

1. `powder-galaxy-dead-code-audit`
2. `powder-galaxy-zero-gc-audit`
3. `powder-galaxy-window-hud`
4. `powder-galaxy-boot-debug`

### Phase C. Fold the existing Phase 2 migration skill into the repo ecosystem

Options:

- Keep `migrate-powder-galaxy-phase-2` as a user-local specialist skill, or
- convert it into a repo-local `powder-galaxy-planet-migration` skill once the migration pattern expands beyond Explorer.

My recommendation:

- keep it as-is until the Explorer migration is done,
- then generalize it into a broader migration skill once a second or third migrated planet exists.

## Proposed Skill Ownership Rules

- Repo-local skills under `.github/skills/` should describe canonical architecture and project policy.
- User-local skills under `.codex/skills/` should hold temporary or campaign-specific workflows such as a particular migration phase.
- Once a user-local Powder Galaxy skill becomes generally reusable for the repo, promote it into `.github/skills/`.

## Proposed Implementation Order

1. Finish the dead-code audit and canonical-path decisions.
2. Extract `powder-galaxy-dead-code-audit` from the current audit work.
3. Extract `powder-galaxy-zero-gc-audit` using `UNIVERSE_LAWS.md`, `tools/zero-gc-lint.js`, and hot-path rules.
4. Extract `powder-galaxy-window-hud` after the window stack is consolidated.
5. Revisit the master skill and shorten it again once those child skills exist.

## Suggested Template for Future Powder Galaxy Skills

Each new skill should answer these questions with minimal context:

1. What exact task should trigger it?
2. Which canonical files must be read first?
3. Which commands or validations must run?
4. Which legacy paths must be avoided?
5. What counts as done?

## Immediate Next Step

After you approve the dead-code audit, the cleanest next deliverable is:

- a repo-local `powder-galaxy-dead-code-audit` skill seeded from `docs/dead-code-audit.md`, or
- the first low-risk cleanup batch described in that audit.
