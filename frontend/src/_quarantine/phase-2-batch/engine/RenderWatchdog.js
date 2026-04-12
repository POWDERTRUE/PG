/**
 * RenderWatchdog.js — V31
 * Frame-health monitor for the OMEGA engine loop.
 *
 * Detects render stalls (frames taking > stallThreshold ms) and emits
 * a 'watchdog:stall' event via the EventBus instead of force-calling
 * scheduler.update() — which could cause double-tick race conditions.
 *
 * Usage:
 *   RenderWatchdog.start(kernel);        // called by UniverseKernel.boot()
 *   RenderWatchdog.stop();               // auto-called on kernel shutdown
 *
 * Recovery:
 *   Registry.get('events').on('watchdog:stall', ({ delta, stallCount }) => { ... });
 */
import { Registry } from './core/ServiceRegistry.js';

export class RenderWatchdog {
    static lastFrameTime = typeof performance !== 'undefined' ? performance.now() : 0;
    static stallThreshold  = 1000; // ms — treat gaps > 1s as a stall
    static checkInterval   = 250;  // ms — polling rate
    static intervalId      = null;
    static stallCount      = 0;    // total stalls since start (for diagnostics)
    static _events         = null; // EventBus reference

    /** @param {import('./UniverseKernel.js').UniverseKernel} kernel */
    static start(kernel) {
        if (this.intervalId) clearInterval(this.intervalId);

        this.stallCount = 0;
        this._events = Registry.tryGet?.('events') ?? Registry.get?.('events') ?? null;

        console.log('%c[Watchdog] V31 Frame-health monitor active.', 'color:#f59e0b;font-weight:bold');

        this.intervalId = setInterval(() => {
            const now   = performance.now();
            const delta = now - this.lastFrameTime;

            if (delta > this.stallThreshold) {
                this.stallCount++;
                const msg = `[Watchdog] ⚠️ RENDER STALL #${this.stallCount}: ${delta.toFixed(0)}ms (>${this.stallThreshold}ms)`;
                console.warn(msg);

                // V31: emit event instead of force-calling scheduler (avoids double-tick)
                // Subscribers (e.g. kernel) can decide what recovery action to take.
                this._events?.emit('watchdog:stall', {
                    delta,
                    stallCount: this.stallCount,
                    timestamp:  now,
                });

                // Reset lastFrameTime so the *next* interval doesn't re-trigger
                this.lastFrameTime = now;
            }
        }, this.checkInterval);

        // Track the last frame timestamp via EventBus when the loop is healthy
        if (this._events) {
            this._events.on('frame:begin', () => {
                RenderWatchdog.lastFrameTime = performance.now();
            });
        }
    }

    static stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        console.log(`[Watchdog] Stopped. Total stalls detected: ${this.stallCount}`);
    }

    /** @returns {{ stallCount: number, threshold: number, interval: number }} */
    static getStats() {
        return {
            stallCount:  this.stallCount,
            threshold:   this.stallThreshold,
            interval:    this.checkInterval,
            lastFrameMs: performance.now() - this.lastFrameTime,
        };
    }
}

