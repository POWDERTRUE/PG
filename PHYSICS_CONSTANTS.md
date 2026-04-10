# POWDER GALAXY PHYSICS & MATHEMATICS AXIOMS
Autonomous Simulation Constants - The Immutable Numeric Treaty

## [0] THE CONSTANT INJECTION DIRECTIVE
You are LULU. When writing physics, rendering, or generation logic, you are STRICTLY FORBIDDEN from hardcoding "magic numbers" into calculations.
- **LAW 1:** All numeric values below represent the absolute boundaries of the Powder Galaxy Universe.
- **LAW 2:** If generating a system that requires these values, you MUST assume they are globally accessible via the `ServiceRegistry` (e.g., `this.registry.get('constants')`) or explicitly declare them as `static readonly` properties at the top of your class.
- **LAW 3:** Any violation of scale (e.g., generating a planet with radius 5000 when the max is 180) is a critical architectural failure.

## [1] UNIVERSAL & ORBITAL CONSTANTS (Phase 2: Simulation)
The universe relies on a modified gravitational constant to prevent floating-point explosion at cosmic scales.
- `G` (Gravitational Constant): `0.1`
- `M_SUN` (Anchor Mass): `333,000`
- `M_PLANET` (Mass Range): `10` to `110`
- `MAX_VELOCITY` (Flight/Camera): `800 u/s` (Base: `160 u/s`, Shift Multiplier: `5x`)
- **Hitbox Culling:** Planetary physics calculations are culled beyond `180 u` (invisible boundary sphere).

## [2] GALACTIC PROCEDURAL GENERATION (Phase 3: Generation)
When weaving the galaxy via `GalaxyGenerationSystem`, you MUST adhere to the Spiral Logarithmic equation.
- `ARMS`: `5` (Number of spiral arms)
- `SCALE` ($a$): `100 u` (Base spiral scale)
- `WIND` ($b$): `0.26` (Spiral tightness)
- `R_MAX`: `8000 u` (Absolute galactic boundary)
- `HALO_R`: `11000 u`
- `BULGE_R`: `1200 u`
- `CORE_R`: `280 u`
- `DISK_H`: `90 u` (Y-axis thickness limit)
- `OMEGA` ($\omega$): `0.000035 rad/f` (Global rotational velocity)
- `N_STARS`: `120000` (Max instanced meshes for main sequence stars)

## [3] IMMUTABLE MATHEMATICAL FORMULAS
When writing calculation logic inside the `update()` loop, you MUST implement these exact formulas using pre-allocated `THREE.Vector3` objects.

**A. Logarithmic Spiral (Procedural Placement)**
To place a star in a spiral arm, calculate the radius $r$ and angle $\theta$:
$r = a \cdot e^{b \cdot \theta}$
$\theta = \frac{\ln(r / a)}{b}$

**B. Keplerian Orbital Velocity (Analytical)**
For planets orbiting a static sun, do NOT use N-body physics. Use pure Keplerian math to save CPU:
$v = \sqrt{\frac{G \cdot M_{central}}{r}}$

**C. Gravity / N-Body Force (Dynamic)**
For dynamic entities (ships, asteroids), calculate normalized acceleration $\vec{a}$:
$F = G \frac{M}{r^2}$
$\vec{a} = -\text{normalize}(\vec{r}) \cdot F$

**D. Core Density Falloff**
To cluster stars at the galactic center, use exponential decay:
$\rho(r) = e^{-\frac{r}{CORE\_R}}$

## [4] SECTOR STREAMING THRESHOLDS (Phase 4: Streaming)
The universe is chunked to prevent RAM overflow. You must strictly obey these spatial boundaries:
- **Sector Dimensions:** `X: 2000 u`, `Y: 600 u`, `Z: 2000 u`.
- **Active Grid:** `±2` Sectors in X/Z (Max 25 active sectors). `±1` Sector in Y (Max 3 active levels).
- **Streaming Boundaries:**
  - `NO_STREAM_RADIUS`: `< 4000 u` (Central galaxy manages itself).
  - `MAX_STREAM_RADIUS`: `22000 u` (The edge of existence).
- **Tick Rate:** Sector checks MUST NOT run every frame. They must execute every `90 frames` ($\approx 1.5s$) to prevent CPU bottlenecking.

## [5] RENDER & OPTICS CONSTANTS (Phase 5: Render)
- **Camera Optics:** FOV Base `55°`, Min `25°`, Max `100°`.
- **Clipping Planes:** Near `0.1 u`, Far `50000 u`. (If far clipping is exceeded, the Z-buffer will fail).
- **Tone Mapping:** `THREE.ACESFilmicToneMapping` (Mandatory for cinematic lighting).
- **Pixel Ratio:** `Math.min(window.devicePixelRatio, 2)` (Mandatory limit to prevent 4K mobile devices from crashing the GPU).
- **Atmospheric Fresnel:** $fresnel = (1.0 - (\vec{N} \cdot \vec{V}))^{power}$
## [6] HELMET ANALYTICS PROXIES (Phase 6: Visor)
The internal helmet visor may expose mathematical readings, but they must be derived from canonical body metadata and clearly treated as proxies when the runtime uses abstract units.

- **Surface Gravity Proxy:** `g_surface = 9.80665 * gravityG`
- **Radius Proxy (Earth-scaled):** `R_proxy = sqrt(M_proxy / gravityG)`
- **Escape Velocity Proxy:** `v_escape = 11.186 * sqrt(M_proxy / R_proxy)` km/s
- **Density Proxy:** `rho_proxy = 5.51 * (M_proxy / R_proxy^3)` g/cm^3
- **Solar Conversion:** `M_proxy = massSolar * 333000` when a stellar body is expressed in solar masses.
- **Orbital Period Reference:** If `orbitalPeriodDays` exists in a `bodyProfile`, the visor should prefer that canonical reference over inventing a fake runtime period.

## [7] DISCLOSURE RULES FOR MATHEMATICAL UI
Mathematics inside the visor is part of gameplay readability, not decoration.

- Never flood the player with all formulas at once.
- Show one dominant formula per target state:
  - `v_e = sqrt(2GM / r)` for planets and stars.
  - `omega = sqrt(GM / r^3)` for satellites.
  - `tau = d / c` for drone transmissions and signal timing.
- Formula text must live on the edges of the viewport, not on the center line of flight.
- Any value computed from analog profiles instead of runtime simulation must be labeled or implied as a proxy/reference.
