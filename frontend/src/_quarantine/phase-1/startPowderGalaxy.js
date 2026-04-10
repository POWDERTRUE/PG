/* =========================================================
   ⚠️  DEPRECATED — V28 OMEGA BOOTSTRAP (ARCHIVED)
   This file uses the OLD API (kernel.systems, kernel.scheduler, kernel.start).
   It is NOT loaded by index.html. The active entry point is: src/main.js
   DO NOT reference this file in any <script> tag.
   ========================================================= */

/* =========================================================
   POWDER GALAXY ENGINE
   REFINED PRO BOOTSTRAP (V28 OMEGA)
   ========================================================= */

import { UniverseKernel } from './engine/UniverseKernel.js';

/**
 * 1. SINGLETON PROTECTION & GLOBAL STATE
 */
function ensureEngineSingleton() {
    if (window.__POWDER_GALAXY__?.running) {
        console.warn("%c[PowderGalaxy] Engine already running.", "color: #ffaa00; font-weight: bold;");
        return false;
    }

    const params = new URLSearchParams(location.search);
    const debug = params.has('debug');

    window.__POWDER_GALAXY__ = {
        running: true,
        kernel: null,
        debug: debug,
        version: "V28-OMEGA",
        startTime: performance.now()
    };

    if (debug) {
        console.log("%c[Engine] DEBUG MODE ACTIVE", "background: #f00; color: #fff; padding: 2px 5px;");
    }

    return true;
}

/**
 * 2. BASE CSS NORMALIZATION
 */
function applyEngineBaseCSS() {
    const css = `
        html, body {
            margin: 0;
            padding: 0;
            height: 100%;
            width: 100%;
            overflow: hidden;
            background: black;
            user-select: none;
            -webkit-user-select: none;
        }
        #pg-renderer {
            display: block;
            width: 100%;
            height: 100%;
            position: absolute;
            top: 0;
            left: 0;
            touch-action: none;
        }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    document.documentElement.style.backgroundColor = "black";
    document.body.style.position = "fixed";
}

/**
 * 3. DOM LAYER ORCHESTRATION
 */
function createDOMLayers() {
    let canvas = document.getElementById('pg-renderer');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'pg-renderer';
        document.body.appendChild(canvas);
    }

    let labelLayer = document.getElementById('label-layer');
    if (!labelLayer) {
        labelLayer = document.createElement('div');
        labelLayer.id = 'label-layer';
        labelLayer.style.cssText = "position: fixed; inset: 0; pointer-events: none; z-index: 500;";
        document.body.appendChild(labelLayer);
    }

    let hudLayer = document.getElementById('hud-layer');
    if (!hudLayer) {
        hudLayer = document.createElement('div');
        hudLayer.id = 'hud-layer';
        hudLayer.style.cssText = "position: fixed; inset: 0; pointer-events: none; z-index: 1000;";
        document.body.appendChild(hudLayer);
    }

    return { canvas, labelLayer, hudLayer };
}

/**
 * 4. REFINED FRAME LOOP
 */
function createFrameLoop(scheduler) {
    if (!scheduler || typeof scheduler.update !== 'function') {
        console.warn('[FrameLoop] scheduler missing or no update() method; skipping legacy frame loop.');
        return;
    }

    let last = performance.now();
    let paused = false;

    document.addEventListener("visibilitychange", () => {
        paused = document.hidden;
        if (!paused) {
            last = performance.now();
            if (window.__POWDER_GALAXY__.debug) console.log("[Engine] Resumed.");
        }
    });

    function frame(time) {
        requestAnimationFrame(frame);
        if (paused) return;

        let delta = (time - last) / 1000;
        last = time;

        delta = Math.max(0, Math.min(delta, 0.1));

        scheduler.update(delta, time / 1000);
    }

    requestAnimationFrame(frame);
}

/**
 * 5. RESIZE HANDLER (HiDPI Aware)
 */
function initResize(kernel) {
    window.addEventListener("resize", () => {
        const pipeline = kernel.systems.get("RenderPipeline");
        if (pipeline) {
            pipeline.resize(
                window.innerWidth, 
                window.innerHeight,
                window.devicePixelRatio
            );
        }
    });
}

/**
 * 6. BOOTSTRAP MAIN
 */
async function startPowderGalaxy() {
    if (!ensureEngineSingleton()) return;

    console.log("%c🚀 [Boot] OMEGA Horizons V14 Initializing...", "color: #00ffaa; font-weight: bold;");

    applyEngineBaseCSS();
    const { canvas, labelLayer, hudLayer } = createDOMLayers();

    const kernel = new UniverseKernel({
        canvas,
        labelContainer: labelLayer,
        hudContainer: hudLayer
    });

    window.__POWDER_GALAXY__.kernel = kernel;

    // V15 Hardened Boot: Start frame loop BEFORE async boot to allow fallback rendering
    createFrameLoop(kernel.scheduler);
    initResize(kernel);

    try {
        await kernel.boot(); 

        // V33: Immediate Heartbeat Ascension
        kernel.start();

        console.log("%c🌌 [Boot] OMEGA protocol complete. System Ready.", "color: #00f0ff; font-weight: bold;");

        // Wire DOM → Engine Input
        setupInputBridge(kernel);

        // Lifecycle Bridge (Deterministic)
        setupOSLifecycle(kernel);

        // V33: Automatic Debug Ascension
        if (window.__POWDER_GALAXY__.debug) {
            console.log("%c⚡ [Kernel] Debug mode detected. Ascending without login...", "color: #ffaa00;");
            kernel.events.emit('os:login_success'); 
        }

    } catch (err) {
        console.error("%c❌ [Boot] Critical Failure:", "color: #ff4444; font-weight: bold;", err);
        window.__POWDER_GALAXY__.running = false;
        throw err;
    }
}

/**
 * 7. DOM → ENGINE INPUT BRIDGE
 */
function setupInputBridge(kernel) {
    const canvas = document.getElementById('pg-renderer');
    const input = kernel.systems.get('SpatialInputSystem');
    const events = kernel.events;

    if (!input) {
        console.warn('[InputBridge] SpatialInputSystem not found.');
        return;
    }

    // Mouse Move
    window.addEventListener('mousemove', (e) => {
        input.injectMouseMove(
            e.clientX, e.clientY,
            e.movementX || 0, e.movementY || 0,
            window.innerWidth, window.innerHeight
        );
    }, { passive: true });

    // Mouse Down / Up (track drag state for orbit)
    window.addEventListener('mousedown', (e) => {
        input.injectMouseDown(e);
        events.emit('input:mousedown', { event: e, button: e.button });
    });
    window.addEventListener('mouseup', (e) => {
        input.injectMouseUp(e);
        events.emit('input:mouseup', { event: e, button: e.button });
    });

    // Click / Double Click
    window.addEventListener('click', (e) => input.injectClick(e));
    window.addEventListener('dblclick', (e) => input.injectDoubleClick(e));

    // Keyboard
    window.addEventListener('keydown', (e) => input.injectKeyDown(e.code));
    window.addEventListener('keyup', (e) => input.injectKeyUp(e.code));

    // Wheel → Zoom
    window.addEventListener('wheel', (e) => {
        e.preventDefault();
        events.emit('input:wheel', { deltaY: e.deltaY });
    }, { passive: false });

    // Context Menu (prevent)
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // Pointer Lock
    events.on('engine:request_pointer_lock', () => {
        kernel.pointerPresentationController?.requestPointerLock?.({
            source: 'legacy-engine-event',
        }) ?? canvas.requestPointerLock?.();
    });

    document.addEventListener('pointerlockchange', () => {
        input.setPointerLockState(document.pointerLockElement === canvas);
    });

    console.log('%c[InputBridge] DOM → Engine wiring complete.', 'color: #8aff00;');
}

/**
 * 7. OS LIFECYCLE BRIDGE
 */
function setupOSLifecycle(k) {
    k.events.on('engine:boot_complete', async () => {
        if (window.__POWDER_GALAXY__.debug) return; // Skip login in debug

        const { LoginPanel } = await import('./ui/LoginPanel.js');
        const login = new LoginPanel(k);
        login.render();
    });

    k.events.on('os:login_success', async () => {
        // kernel.start() is now called globally after boot or manually if needed
        const { hudController } = await import('./ui/HUDController.js');
        hudController.init(k);
    });
}

// AUTO-START
startPowderGalaxy();

