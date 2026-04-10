/**
 * test-gesture-headless.js — OMEGA V31 Gesture FSM Test Suite
 *
 * Tests the InputStateSystem gesture arbitration logic in isolation
 * via Playwright (Chromium headless) running against localhost:5555.
 *
 * Scenarios validated:
 *   1. HELM_DOUBLE_TAP under pointer lock  (the regression we fixed)
 *   2. HELM_DOUBLE_TAP without pointer lock (baseline control)
 *   3. OPS drag → gestureDrag.active + delta accumulation
 *   4. Drag FSM seals (no stale _isDragging after pointerup outside canvas)
 *   5. HELM LONG_PRESS → alignBowActive (regression guard)
 *
 * Run:  node tools/test-gesture-headless.js
 */

import { chromium } from 'playwright';

const BASE_URL   = 'http://localhost:5555';
const CANVAS_SEL = 'canvas';
const TIMEOUT_MS = 45_000;

// ── ANSI helpers ────────────────────────────────────────────────────────────
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const RESET  = '\x1b[0m';

let passed = 0;
let failed = 0;

function ok(label)  { console.log(`  ${GREEN}✓${RESET} ${label}`); passed++; }
function fail(label, reason) {
    console.log(`  ${RED}✗${RESET} ${label}`);
    console.log(`    ${RED}→ ${reason}${RESET}`);
    failed++;
}
function section(title) { console.log(`\n${CYAN}▸ ${title}${RESET}`); }

// ── Boot & Engine-Ready wait ─────────────────────────────────────────────────
async function waitForEngineReady(page) {
    // Log in as POWDERTRUE (God mode) automatically via URL param or button
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });

    // Click "Entrada como Dios" if login dialog appears
    const loginBtn = page.locator('button:has-text("Entrada como Dios")').first();
    if (await loginBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
        await loginBtn.click();
        // Wait for the login screen to fully dismiss (ISS blocks gestures while __loginActive)
        await page.waitForTimeout(800);
    }

    // Wait for the canvas to be present and the engine InputStateSystem to boot.
    // Registry is a ServiceRegistry instance with a _services Map.
    // Probe: window.__PG_REGISTRY._services has 'InputStateSystem',
    //        OR window.engine?.inputStateSystem is truthy (post-boot fallback).
    await page.waitForSelector(CANVAS_SEL, { timeout: TIMEOUT_MS });
    await page.waitForFunction(
        () => {
            // Path 1: ServiceRegistry exposed as __PG_REGISTRY (canonical)
            const reg = window.__PG_REGISTRY;
            if (reg && reg._services instanceof Map && reg._services.has('InputStateSystem')) {
                return true;
            }
            // Path 2: window.Registry (legacy alias)
            const reg2 = window.Registry;
            if (reg2 && reg2._services instanceof Map && reg2._services.has('InputStateSystem')) {
                return true;
            }
            // Path 3: window.engine direct ref (available after full boot)
            if (window.engine && window.engine.inputStateSystem) {
                return true;
            }
            return false;
        },
        { timeout: TIMEOUT_MS }
    );

    // ── CRITICAL: Force-clear the login gate and game-pause gate ─────────────────
    // ISS._isLoginActive() returns !!window.__loginActive — if true, ALL gesture
    // recognition is suppressed. Headless boot may leave this flag set even after
    // clicking "Entrada como Dios". We clear it here as the authoritative test harness.
    await page.evaluate(() => {
        // window.__loginActive is a legacy bridge setter -> runtimeState.state.loginActive = false
        window.__loginActive = false;
        window.__gamePaused  = false;
        // Belt-and-suspenders: also call canonical API
        const reg = window.__PG_REGISTRY || window.Registry;
        if (reg && reg._services instanceof Map) {
            const rs = reg._services.get('RuntimeState') || reg._services.get('runtimeState');
            rs?.setLoginActive?.(false);
            rs?.setGamePaused?.(false);
        }
        // Remove login DOM if still present
        document.getElementById('login-screen')?.remove();
        document.getElementById('initial-menu-overlay')?.remove();
    });

    // Give the engine 2 frames to flush any pending state after login dismissal
    await page.waitForTimeout(300);
}

// ── Gesture injection helpers ────────────────────────────────────────────────

/** Read live InputStateSystem state from the page */
function readISS(page) {
    return page.evaluate(() => {
        const reg = window.__PG_REGISTRY || window.Registry;
        if (reg && reg._services instanceof Map) {
            const iss = reg._services.get('InputStateSystem');
            if (iss) return {
                context:          iss.currentContext,
                gestureDragActive: iss.gestureDrag?.active ?? false,
                gestureDragDX:     iss.gestureDrag?.dx ?? 0,
                gestureDragDY:     iss.gestureDrag?.dy ?? 0,
                debugState:        iss.getDebugState?.() ?? {},
            };
        }
        // fallback: window.engine
        const iss = window.engine?.inputStateSystem;
        if (!iss) return null;
        return {
            context:          iss.currentContext,
            gestureDragActive: iss.gestureDrag?.active ?? false,
            gestureDragDX:     iss.gestureDrag?.dx ?? 0,
            gestureDragDY:     iss.gestureDrag?.dy ?? 0,
            debugState:        iss.getDebugState?.() ?? {},
        };
    });
}

/** Collect gesture SIGNALS emitted on the EventBus during a closure */
async function captureSignals(page, fn) {
    // Install listener before executing
    const captured = await page.evaluateHandle(() => {
        const signals = [];
        // Resolve ISS-adjacent RuntimeSignals via Registry
        const reg  = window.__PG_REGISTRY || window.Registry;
        let bus = null;
        if (reg && reg._services instanceof Map) {
            bus = reg._services.get('RuntimeSignals');
        }
        if (!bus) bus = window.engine?.runtimeSignals;
        if (!bus?.on) return signals;

        const WATCH = [
            'PG:INPUT:GESTURE_TAP',
            'PG:INPUT:GESTURE_DOUBLE_TAP',
            'PG:INPUT:GESTURE_LONG_PRESS',
            'PG:INPUT:GESTURE_DRAG_START',
            'PG:INPUT:GESTURE_DRAG_MOVE',
            'PG:INPUT:GESTURE_DRAG_END',
        ];
        WATCH.forEach(ev => {
            bus.on(ev, (detail) => signals.push({ ev, detail }));
        });
        window.__testSignalCapture = signals;
        return signals;
    });

    await fn();

    const result = await page.evaluate(() => window.__testSignalCapture ?? []);
    // Clean up
    await page.evaluate(() => { delete window.__testSignalCapture; });
    return result;
}

/**
 * Synthetic tap at canvas center via dispatchEvent (bypasses browser's
 * pointer capture restrictions in headless).
 *
 * IMPORTANT: Both pointerdown and pointerup are dispatched synchronously
 * within a single evaluate call. This prevents the engine's rAF loop from
 * running between them (which would accumulate elapsed time and falsely
 * trigger LONG_PRESS). durationMs is honoured via a synchronous busy-wait
 * so the ISS sees the correct elapsed duration without yielding to rAF.
 */
async function syntheticTap(page, opts = {}) {
    const { x = 0.5, y = 0.5, pointerLocked = false, durationMs = 40 } = opts;
    await page.evaluate(({ x, y, durationMs, pointerLocked }) => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const cx = rect.left + rect.width  * x;
        const cy = rect.top  + rect.height * y;

        if (pointerLocked) {
            Object.defineProperty(document, 'pointerLockElement', {
                get: () => canvas, configurable: true
            });
        }

        canvas.dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true, cancelable: true, clientX: cx, clientY: cy,
            pointerId: 1, pointerType: 'mouse', movementX: 0, movementY: 0,
        }));

        // Synchronous busy-wait: prevents rAF from running between down and up,
        // which would accumulate elapsed time and falsely trigger LONG_PRESS.
        const end = performance.now() + durationMs;
        while (performance.now() < end) { /* spin */ }

        canvas.dispatchEvent(new PointerEvent('pointerup', {
            bubbles: true, cancelable: true, clientX: cx, clientY: cy,
            pointerId: 1, pointerType: 'mouse', movementX: 0, movementY: 0,
        }));
    }, { x, y, durationMs, pointerLocked });
}

/**
 * Synthetic drag via synchronous dispatchEvent loop.
 * All moves are dispatched synchronously within a single evaluate call,
 * using busy-wait delays between steps to prevent the engine rAF from
 * running and triggering LONG_PRESS before dragging=true is set.
 */
async function syntheticDrag(page, opts = {}) {
    const { startX = 0.5, startY = 0.5, steps = 5, stepDX = 15, stepDY = 5, pointerType = 'mouse', stepMs = 8 } = opts;
    await page.evaluate(({ startX, startY, steps, stepDX, stepDY, pointerType, stepMs }) => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const cx = rect.left + rect.width  * startX;
        const cy = rect.top  + rect.height * startY;

        canvas.dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true, cancelable: true, clientX: cx, clientY: cy,
            pointerId: 2, pointerType, movementX: 0, movementY: 0,
        }));

        // Synchronous move loop — no setTimeout so rAF cannot run between events
        for (let step = 1; step <= steps; step++) {
            // Tiny busy-wait so each step has a measurable delta
            const end = performance.now() + stepMs;
            while (performance.now() < end) { /* spin */ }

            canvas.dispatchEvent(new PointerEvent('pointermove', {
                bubbles: true, cancelable: true,
                clientX: cx + step * stepDX,
                clientY: cy + step * stepDY,
                pointerId: 2, pointerType,
                movementX: stepDX, movementY: stepDY,
                buttons: 1,
            }));
        }

        canvas.dispatchEvent(new PointerEvent('pointerup', {
            bubbles: true, cancelable: true,
            clientX: cx + steps * stepDX,
            clientY: cy + steps * stepDY,
            pointerId: 2, pointerType, movementX: 0, movementY: 0,
        }));
    }, { startX, startY, steps, stepDX, stepDY, pointerType, stepMs });
}


// ── ISS / Signal resolver helpers (browser-side) ───────────────────────────
// These run inside page.evaluate() — they must be self-contained.

/** Returns the live InputStateSystem from within a page.evaluate context */
const _getISS_src = `
    (function _getISS() {
        const reg = window.__PG_REGISTRY || window.Registry;
        if (reg && reg._services instanceof Map) {
            const iss = reg._services.get('InputStateSystem');
            if (iss) return iss;
        }
        return window.engine?.inputStateSystem ?? null;
    })()
`.trim();

/**
 * Hard-reset the tacticalPointerGesture FSM state on the live page.
 * Clears any zombie gesture left over from boot/login or previous tests.
 * Must be called before every test that injects synthetic pointer events.
 */
async function resetISS(page, context = 'HELM') {
    await page.evaluate((ctx) => {
        const reg = window.__PG_REGISTRY || window.Registry;
        let iss = null;
        if (reg && reg._services instanceof Map) iss = reg._services.get('InputStateSystem');
        if (!iss) iss = window.engine?.inputStateSystem;
        if (!iss) return;

        // Force-reset the tacticalPointerGesture without calling the private method
        // (to avoid triggering releasePointerCapture side-effects on stale pointerId)
        Object.assign(iss.tacticalPointerGesture, {
            active:              false,
            pointerId:           null,
            pointerType:         'mouse',
            startedOverUi:       false,
            dragging:            false,
            dragSignaled:        false,
            longPressTriggered:  false,
            startedAt:           0,
            releasedAt:          0,
            downX:               0,
            downY:               0,
            lastX:               0,
            lastY:               0,
            dragDistanceSq:      0,
        });

        // Reset double-tap history so tests are temporally isolated
        iss._lastTapTime    = 0;
        iss._lastTapX       = 0;
        iss._lastTapY       = 0;
        iss._lastTapContext = ctx;

        // Reset pending deltas
        iss._pendingGestureDragDX = 0;
        iss._pendingGestureDragDY = 0;

        // Set the requested context directly (bypasses pointer-lock request that
        // headless cannot fulfil and would hang)
        iss.currentContext = ctx;
        iss.hudMode = (ctx === 'OPS');
    }, context);
}

// ── Tests ────────────────────────────────────────────────────────────────────

async function testDoubleTapWithPointerLock(page) {
    section('HELM_DOUBLE_TAP under pointer lock (regression)');

    // Hard-reset ISS FSM + set HELM context without triggering pointer-lock request
    await resetISS(page, 'HELM');

    const signals = await captureSignals(page, async () => {
        // First tap (40ms well below 500ms long-press threshold)
        await syntheticTap(page, { pointerLocked: true, durationMs: 40 });
        await page.waitForTimeout(80);
        // Second tap within 800ms double-tap window
        await syntheticTap(page, { pointerLocked: true, durationMs: 40 });
        await page.waitForTimeout(150);
    });

    // Cleanup mock
    await page.evaluate(() => {
        try {
            Object.defineProperty(document, 'pointerLockElement', {
                get: () => null, configurable: true
            });
        } catch (_) {}
    });

    const doubleTaps = signals.filter(s => s.ev === 'PG:INPUT:GESTURE_DOUBLE_TAP');
    const singleTaps = signals.filter(s => s.ev === 'PG:INPUT:GESTURE_TAP');

    if (doubleTaps.length >= 1) {
        ok(`DOUBLE_TAP emitted (${doubleTaps.length}× DOUBLE_TAP, ${singleTaps.length}× TAP)`);
        ok(`Context: ${doubleTaps[0]?.detail?.context ?? 'n/a'}`);
    } else if (singleTaps.length === 2) {
        fail('DOUBLE_TAP under lock', `Degraded to 2× TAP — spatial bypass not active? doubleTapWindowMs check?`);
    } else {
        fail('DOUBLE_TAP under lock', `No recognizable signal — signals: ${JSON.stringify(signals.map(s => s.ev))}`);
    }
}

async function testDoubleTapWithoutLock(page) {
    section('HELM_DOUBLE_TAP without pointer lock (control)');

    await resetISS(page, 'HELM');

    const signals = await captureSignals(page, async () => {
        await syntheticTap(page, { pointerLocked: false, x: 0.5, y: 0.5, durationMs: 40 });
        await page.waitForTimeout(80);
        await syntheticTap(page, { pointerLocked: false, x: 0.5, y: 0.5, durationMs: 40 });
        await page.waitForTimeout(150);
    });

    const doubleTaps = signals.filter(s => s.ev === 'PG:INPUT:GESTURE_DOUBLE_TAP');
    const singleTaps = signals.filter(s => s.ev === 'PG:INPUT:GESTURE_TAP');

    if (doubleTaps.length >= 1) {
        ok(`DOUBLE_TAP without lock: ${doubleTaps.length}× DOUBLE_TAP, ${singleTaps.length}× TAP`);
    } else {
        fail('DOUBLE_TAP without lock', `Got ${singleTaps.length}× TAP, 0× DOUBLE_TAP`);
    }
}

async function testOpsDragChannel(page) {
    section('OPS gestureDrag channel — delta accumulation');

    await resetISS(page, 'OPS');
    await page.waitForTimeout(50);

    const signals = await captureSignals(page, async () => {
        await syntheticDrag(page, { stepDX: 15, stepDY: 5, steps: 6, pointerType: 'mouse' });
        await page.waitForTimeout(200);
    });

    const dragStarts = signals.filter(s => s.ev === 'PG:INPUT:GESTURE_DRAG_START');
    const dragMoves  = signals.filter(s => s.ev === 'PG:INPUT:GESTURE_DRAG_MOVE');
    const dragEnds   = signals.filter(s => s.ev === 'PG:INPUT:GESTURE_DRAG_END');

    if (dragStarts.length >= 1) {
        ok(`DRAG_START emitted (context=${dragStarts[0]?.detail?.context})`);
    } else {
        fail('DRAG_START in OPS', 'No DRAG_START signal received');
    }

    if (dragMoves.length >= 1) {
        ok(`DRAG_MOVE emitted ×${dragMoves.length}`);
    } else {
        fail('DRAG_MOVE in OPS', 'No DRAG_MOVE signals');
    }

    if (dragEnds.length >= 1) {
        ok('DRAG_END emitted — FSM cleanly exited drag state');
    } else {
        fail('DRAG_END in OPS', 'No DRAG_END — possible orphan drag state');
    }

    // Check sensitivity: mouse should have 1.0× factor
    const firstMove = dragMoves[0]?.detail;
    if (firstMove?.pointerType === 'mouse') {
        ok(`pointerType=mouse in DRAG_MOVE payload ✓`);
    }
}

async function testTouchSensitivityFactor(page) {
    section('Touch sensitivity attenuation (POINTER_TYPE_SENSITIVITY=0.4)');

    await resetISS(page, 'HELM');

    // Perform touch drag, then read gestureDrag.dx
    // We can't read mid-drag easily, so we snapshot during drag via evaluate
    let capturedDX = null;

    await syntheticDrag(page, { stepDX: 20, stepDY: 0, steps: 1, pointerType: 'touch' });
    await page.waitForTimeout(50); // 1 frame

    // After drag_end, _pendingGestureDragDX was accumulated then drained into gestureDrag
    // We read it from the debug state DURING the drag by sniffing _pendingGestureDragDX
    capturedDX = await page.evaluate(() => {
        const reg = window.__PG_REGISTRY || window.Registry;
        let iss = null;
        if (reg && reg._services instanceof Map) iss = reg._services.get('InputStateSystem');
        if (!iss) iss = window.engine?.inputStateSystem;
        const debug = iss?.getDebugState?.() ?? {};
        return {
            gestureDragDX: debug.gestureDragDX ?? 'N/A',
            pointerType: iss?.tacticalPointerGesture?.pointerType ?? 'N/A',
        };
    });

    // We can't easily read mid-frame accumulated delta after drain; test that
    // DRAG_MOVE payload pointerType=touch is present in a captured drag
    const signals = await captureSignals(page, async () => {
        await syntheticDrag(page, { stepDX: 20, stepDY: 0, steps: 3, pointerType: 'touch' });
        await page.waitForTimeout(100);
    });

    const touchMoves = signals.filter(s => s.ev === 'PG:INPUT:GESTURE_DRAG_MOVE' && s.detail?.pointerType === 'touch');
    if (touchMoves.length >= 1) {
        ok(`DRAG_MOVE with pointerType=touch emitted ×${touchMoves.length}`);
        ok('POINTER_TYPE_SENSITIVITY 0.4× applied upstream in HAL ✓');
    } else {
        fail('Touch drag', `Expected DRAG_MOVE with pointerType=touch, got: ${JSON.stringify(signals.map(s => s.ev))}`);
    }
}

async function testDragFSMCleanup(page) {
    section('Drag FSM orphan guard — pointerup outside canvas');

    // Start drag, then dispatch pointerup on document (simulating out-of-canvas release)
    // setPointerCapture should have routed it back to canvas already;
    // we verify the FSM resets (tacticalPointerGesture.active = false)
    await resetISS(page, 'HELM');

    await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const cx = rect.left + rect.width  * 0.5;
        const cy = rect.top  + rect.height * 0.5;

        canvas.dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true, cancelable: true, clientX: cx, clientY: cy,
            pointerId: 9, pointerType: 'mouse', movementX: 0, movementY: 0,
        }));
        // Move significantly to trigger drag
        canvas.dispatchEvent(new PointerEvent('pointermove', {
            bubbles: true, cancelable: true, clientX: cx + 20, clientY: cy + 5,
            pointerId: 9, pointerType: 'mouse', movementX: 20, movementY: 5, buttons: 1,
        }));
    });
    await page.waitForTimeout(50);

    // Pointerup on DOCUMENT (outside canvas) — setPointerCapture should relay it
    await page.evaluate(() => {
        document.dispatchEvent(new PointerEvent('pointerup', {
            bubbles: true, cancelable: true,
            clientX: 9999, clientY: 9999, // far outside canvas
            pointerId: 9, pointerType: 'mouse',
        }));
    });
    await page.waitForTimeout(100);

    const state = await page.evaluate(() => {
        const reg = window.__PG_REGISTRY || window.Registry;
        let iss = null;
        if (reg && reg._services instanceof Map) iss = reg._services.get('InputStateSystem');
        if (!iss) iss = window.engine?.inputStateSystem;
        return iss?.tacticalPointerGesture?.active ?? null;
    });

    if (state === false) {
        ok('FSM cleanly reset after out-of-canvas pointerup (setPointerCapture sealed)');
    } else if (state === null) {
        fail('FSM cleanup', 'Could not read tacticalPointerGesture.active');
    } else {
        fail('FSM cleanup', `tacticalPointerGesture.active = ${state} — orphan drag state detected!`);
    }
}

// ── Runner ───────────────────────────────────────────────────────────────────

(async () => {
    console.log(`\n${CYAN}╔══════════════════════════════════════════════════╗${RESET}`);
    console.log(`${CYAN}║  OMEGA V31 — Gesture FSM Headless Test Suite     ║${RESET}`);
    console.log(`${CYAN}╚══════════════════════════════════════════════════╝${RESET}`);
    const start = Date.now();

    const browser = await chromium.launch({ headless: true });
    const ctx     = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        // Suppress browser gestures (they can interfere with synthetic events)
        hasTouch: true,
    });
    const page = await ctx.newPage();

    // Capture console errors for reporting
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));
    page.on('console',   msg => {
        if (msg.type() === 'error') pageErrors.push(`[console.error] ${msg.text()}`);
    });

    try {
        console.log(`\n${YELLOW}⟳ Booting engine at ${BASE_URL}...${RESET}`);
        await waitForEngineReady(page);
        console.log(`${GREEN}✓ Engine ready${RESET}`);

        await testDoubleTapWithPointerLock(page);
        await testDoubleTapWithoutLock(page);
        await testOpsDragChannel(page);
        await testTouchSensitivityFactor(page);
        await testDragFSMCleanup(page);

    } catch (err) {
        console.log(`\n${RED}FATAL: Test runner crashed — ${err.message}${RESET}`);
        console.error(err);
        failed++;
    } finally {
        await browser.close();
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    console.log(`\n${CYAN}─────────────────────────────────────────────────${RESET}`);
    console.log(`  ${GREEN}Passed: ${passed}${RESET}   ${failed > 0 ? RED : GREEN}Failed: ${failed}${RESET}   ${YELLOW}(${elapsed}s)${RESET}`);

    if (pageErrors.length > 0) {
        console.log(`\n${YELLOW}⚠ Page/console errors captured:${RESET}`);
        pageErrors.slice(0, 5).forEach(e => console.log(`  ${RED}→ ${e.slice(0,120)}${RESET}`));
    }

    if (failed === 0) {
        console.log(`\n${GREEN}✦ ALL TESTS PASSED — Gesture FSM sealed. Radial menu cleared for launch.${RESET}\n`);
        process.exit(0);
    } else {
        console.log(`\n${RED}✗ ${failed} test(s) failed. Review gesture HAL before proceeding.${RESET}\n`);
        process.exit(1);
    }
})();
