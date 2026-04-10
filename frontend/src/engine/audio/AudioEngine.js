/**
 * AudioEngine.js — OMEGA V31 Acoustic Protocol
 *
 * Arq: Oyente Fantasma (Ghost Listener). Cero acoplamiento bidireccional.
 * El motor de juego no sabe que el audio existe. Solo escucha el bus de señales.
 *
 * 4 Capas:
 *   CAPA 1 — UI (taps, menú, confirmaciones)   → OscillatorNode síntesis pura
 *   CAPA 2 — LULU (escáner, voz, ontología)    → Sweep + arpegios FM
 *   CAPA 3 — NAVEGACIÓN (Warp spool/dropout)   → Ruido filtrado + LFO
 *   CAPA 4 — BALÍSTICA (INJ launch/impact)     → Noise burst + decay percusivo
 *
 * LEY 8 (Zero-GC): El grafo de ruteo (GainNode, DynamicsCompressor, BiquadFilter,
 * StereoPannerNode) se pre-asocia en el constructor. Los OscillatorNode y
 * AudioBufferSourceNode se crean por nota (obligatorio en Web Audio API —
 * son one-shot por diseño del spec) pero nunca se acumulan en memoria.
 *
 * ACTIVACIÓN: AudioContext arranca suspendido (política del navegador).
 * resume() debe llamarse desde un evento de usuario. InputStateSystem
 * lo llama en el primer pointerdown.
 */

import { Registry } from '../core/ServiceRegistry.js';

// ── Constantes de síntesis ────────────────────────────────────────────────────

const MASTER_VOLUME   = 0.72;

const CHANNEL_VOLUMES = {
    ui:       0.55,
    lulu:     0.68,
    sfx:      0.90,
    ambience: 0.22,
};

// Frecuencias de la escala pentatónica menor de LULU (La menor: A3→E5)
const LULU_PENTATONIC = [220, 261.63, 311.13, 392, 466.16, 523.25, 622.25, 784];

// ── Helpers de síntesis ───────────────────────────────────────────────────────

/**
 * Construye una envolvente ADSR en un GainNode.
 * @param {GainNode}       gain
 * @param {AudioContext}   ctx
 * @param {number}         t        - currentTime
 * @param {number}         peak     - Volumen máximo (0-1)
 * @param {number}         attack   - segundos
 * @param {number}         decay    - segundos
 * @param {number}         sustain  - nivel (0-1)
 * @param {number}         release  - segundos
 */
function applyADSR(gain, ctx, t, peak, attack, decay, sustain, release) {
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak,          t + attack);
    gain.gain.linearRampToValueAtTime(peak * sustain, t + attack + decay);
    gain.gain.setValueAtTime(peak * sustain,          t + attack + decay);
    gain.gain.exponentialRampToValueAtTime(0.0001,   t + attack + decay + release);
}

// ─────────────────────────────────────────────────────────────────────────────

export class AudioEngine {
    constructor() {
        this.phase       = 'audio';
        this.initialized = false;
        this._firstResume = false;

        // Lazy-init: AudioContext se crea en resume() para evitar autoplay policies
        this.ctx      = null;
        this.masterGain   = null;
        this.compressor   = null;
        this.channels     = null;

        // Ambience: buffer de ruido blanco generado una sola vez (Zero-GC — no recrear)
        this._ambienceBuffer     = null;
        this._ambienceSourceNode = null;
        this._ambienceGain       = null;
        this._ambienceFilter     = null;

        // Estado del Warp (para evitar múltiples spools simultáneos)
        this._warpActive      = false;
        this._warpOscillator  = null;
        this._warpGainNode    = null;

        this._signalRemovers = [];
    }

    // ── Activación (requiere gesto del usuario) ───────────────────────────────

    resume() {
        if (this._firstResume) return;
        this._firstResume = true;

        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this._buildRoutingGraph();
            this._buildAmbienceBuffer();
            this._startAmbience();
            this._initSignalListeners();

            if (this.ctx.state === 'suspended') {
                this.ctx.resume().then(() => {
                    this.initialized = true;
                    console.log('[AudioEngine] 🔊 Acoustic Protocol ONLINE. Ctx estado:', this.ctx.state);
                }).catch(err => {
                    console.warn('[AudioEngine] resume() fallo:', err);
                });
            } else {
                this.initialized = true;
                console.log('[AudioEngine] 🔊 Acoustic Protocol ONLINE.');
            }
        } catch (err) {
            console.warn('[AudioEngine] Web Audio API no disponible:', err);
        }
    }

    // ── Grafo de ruteo pre-alocado (Zero-GC) ─────────────────────────────────

    _buildRoutingGraph() {
        const ctx = this.ctx;

        // Compresor maestro — evita clipping en impactos múltiples
        this.compressor = ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -18;
        this.compressor.knee.value      =  8;
        this.compressor.ratio.value     =  6;
        this.compressor.attack.value    =  0.003;
        this.compressor.release.value   =  0.18;

        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = MASTER_VOLUME;

        this.compressor.connect(this.masterGain);
        this.masterGain.connect(ctx.destination);

        // Canales independientes → Compresor
        this.channels = {};
        for (const [key, vol] of Object.entries(CHANNEL_VOLUMES)) {
            const g = ctx.createGain();
            g.gain.value = vol;
            g.connect(this.compressor);
            this.channels[key] = g;
        }

        // Nodo persistente para la ambience
        this._ambienceGain   = ctx.createGain();
        this._ambienceGain.gain.value = 0;
        this._ambienceFilter = ctx.createBiquadFilter();
        this._ambienceFilter.type            = 'lowpass';
        this._ambienceFilter.frequency.value = 280;
        this._ambienceFilter.Q.value         = 0.8;
        this._ambienceGain.connect(this._ambienceFilter);
        this._ambienceFilter.connect(this.channels.ambience);
    }

    // ── Buffer de ruido blanco (generado una vez, reutilizado indefinidamente) ─

    _buildAmbienceBuffer() {
        const sampleRate  = this.ctx.sampleRate;
        const durationSec = 4; // Loop de 4s — lo suficientemente largo para no notar el corte
        const frameCount  = sampleRate * durationSec;

        this._ambienceBuffer = this.ctx.createBuffer(1, frameCount, sampleRate);
        const data = this._ambienceBuffer.getChannelData(0);
        for (let i = 0; i < frameCount; i++) {
            data[i] = Math.random() * 2 - 1; // ruido blanco
        }
    }

    _startAmbience() {
        if (this._ambienceSourceNode) {
            try { this._ambienceSourceNode.stop(); } catch (_) { /* ya detenido */ }
        }

        const src = this.ctx.createBufferSource();
        src.buffer = this._ambienceBuffer;
        src.loop   = true;
        src.playbackRate.value = 1.0;
        src.connect(this._ambienceGain);
        src.start();
        this._ambienceSourceNode = src;

        // Fade-in suave de la ambience (500ms)
        const t = this.ctx.currentTime;
        this._ambienceGain.gain.setValueAtTime(0, t);
        this._ambienceGain.gain.linearRampToValueAtTime(0.55, t + 0.5);
    }

    // ── Suscripciones al bus de señales ──────────────────────────────────────

    _initSignalListeners() {
        const rs = Registry.tryGet('RuntimeSignals');
        if (!rs) {
            console.warn('[AudioEngine] RuntimeSignals no disponible al init. Audio signals silent.');
            return;
        }

        const on = (signal, fn) => {
            const remove = rs.on(signal, fn);
            if (remove) this._signalRemovers.push(remove);
        };

        // ── CAPA 1: UI & Gestos ──────────────────────────────────────────────
        on('PG:INPUT:GESTURE_TAP',       (p) => {
            // Solo button 0 (ya garantizado por el HAL, pero defensivo)
            if ((p?.button ?? 0) !== 0) return;
            this._playTap();
        });
        on('PG:INPUT:GESTURE_LONG_PRESS', () => this._playLongPressChime());
        on('PG:OS:OPEN_CONTEXT_MENU',     () => this._playMenuOpen());
        on('PG:OS:CLOSE_CONTEXT_MENU',    () => this._playMenuClose());

        // ── CAPA 2: LULU ─────────────────────────────────────────────────────
        on('PG:UI:OPEN_LULU_SCAN',              () => this._playLuluScan());
        on('PG:UI:LULU_SCAN_REFRESH_REQUESTED', () => this._playLuluPing());
        on('PG:UI:PRINT_LULU',                  () => this._playLuluPrint());
        on('PG:OS:TACTICAL_READOUT_REQUESTED',  () => this._playReadout());

        // ── CAPA 3: Navegación / Warp ────────────────────────────────────────
        on('PG:NAV:REQUEST_PRECISION_TRAVEL', () => this._playWarpInitiate());
        on('PG:NAV:WARP_STARTED',             () => this._playWarpSpool());
        on('PG:NAV:WARP_ENDED',               () => this._playWarpDropout());
        on('PG:NAV:ENGAGE_AUTO_BRAKE',        () => this._playBrake());

        // ── CAPA 4: Balística INJ ────────────────────────────────────────────
        on('PG:LULU:REQUEST_PARTICLE_PROJECTOR', () => this._playSwarmLaunch());
        on('PG:LULU:SCAR_COMMITTED',              () => this._playImpact());
    }

    // ═════════════════════════════════════════════════════════════════════════
    // CAPA 1 — UI / GESTOS
    // ═════════════════════════════════════════════════════════════════════════

    /** Tap rápido — feedback táctil mínimo */
    _playTap() {
        if (!this.initialized) return;
        const t   = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.exponentialRampToValueAtTime(660, t + 0.04);

        applyADSR(env, this.ctx, t, 0.35, 0.004, 0.02, 0.0, 0.04);

        osc.connect(env);
        env.connect(this.channels.ui);
        osc.start(t);
        osc.stop(t + 0.07);
    }

    /** Long-press confirmado — acorde de apertura de menú */
    _playLongPressChime() {
        if (!this.initialized) return;
        // Acorde: tónica + quinta + octava
        const freqs = [330, 494, 660];
        freqs.forEach((freq, i) => {
            const t   = this.ctx.currentTime + i * 0.04;
            const osc = this.ctx.createOscillator();
            const env = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t);
            applyADSR(env, this.ctx, t, 0.22, 0.01, 0.08, 0.3, 0.18);
            osc.connect(env);
            env.connect(this.channels.ui);
            osc.start(t);
            osc.stop(t + 0.35);
        });
    }

    /** Menú táctico abierto */
    _playMenuOpen() {
        if (!this.initialized) return;
        const t   = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.linearRampToValueAtTime(660, t + 0.12);
        applyADSR(env, this.ctx, t, 0.28, 0.01, 0.05, 0.5, 0.15);
        osc.connect(env);
        env.connect(this.channels.ui);
        osc.start(t);
        osc.stop(t + 0.30);
    }

    /** Menú táctico cerrado — inverso del open */
    _playMenuClose() {
        if (!this.initialized) return;
        const t   = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, t);
        osc.frequency.linearRampToValueAtTime(330, t + 0.10);
        applyADSR(env, this.ctx, t, 0.18, 0.005, 0.04, 0.0, 0.10);
        osc.connect(env);
        env.connect(this.channels.ui);
        osc.start(t);
        osc.stop(t + 0.18);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // CAPA 2 — LULU
    // ═════════════════════════════════════════════════════════════════════════

    /** Arpeggio ascendente — escáner LULU activo */
    _playLuluScan() {
        if (!this.initialized) return;
        const notes = [0, 2, 4, 7]; // grados pentatónicos
        notes.forEach((degree, i) => {
            const freq = LULU_PENTATONIC[degree];
            const t    = this.ctx.currentTime + i * 0.07;
            const osc  = this.ctx.createOscillator();
            const env  = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, t);
            applyADSR(env, this.ctx, t, 0.22, 0.005, 0.06, 0.2, 0.12);
            osc.connect(env);
            env.connect(this.channels.lulu);
            osc.start(t);
            osc.stop(t + 0.22);
        });

        // Sweep de frecuencia encima del arpeggio
        const sweepT   = this.ctx.currentTime + 0.05;
        const sweepOsc = this.ctx.createOscillator();
        const sweepEnv = this.ctx.createGain();
        sweepOsc.type = 'sawtooth';
        sweepOsc.frequency.setValueAtTime(180, sweepT);
        sweepOsc.frequency.exponentialRampToValueAtTime(3200, sweepT + 0.38);
        sweepEnv.gain.setValueAtTime(0, sweepT);
        sweepEnv.gain.linearRampToValueAtTime(0.14, sweepT + 0.04);
        sweepEnv.gain.exponentialRampToValueAtTime(0.0001, sweepT + 0.38);
        sweepOsc.connect(sweepEnv);
        sweepEnv.connect(this.channels.lulu);
        sweepOsc.start(sweepT);
        sweepOsc.stop(sweepT + 0.40);
    }

    /** Ping de confirmación — datos de escáner actualizados */
    _playLuluPing() {
        if (!this.initialized) return;
        const t   = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046.5, t); // C6
        osc.frequency.exponentialRampToValueAtTime(1318.5, t + 0.06); // E6
        applyADSR(env, this.ctx, t, 0.18, 0.005, 0.03, 0.0, 0.14);
        osc.connect(env);
        env.connect(this.channels.lulu);
        osc.start(t);
        osc.stop(t + 0.20);
    }

    /** Texto LULU imprimiéndose — clic de teletipo suave */
    _playLuluPrint() {
        if (!this.initialized) return;
        const t   = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(
            LULU_PENTATONIC[Math.floor(Math.random() * LULU_PENTATONIC.length)],
            t
        );
        applyADSR(env, this.ctx, t, 0.08, 0.002, 0.01, 0.0, 0.025);
        osc.connect(env);
        env.connect(this.channels.lulu);
        osc.start(t);
        osc.stop(t + 0.04);
    }

    /** Readout táctico confirmado */
    _playReadout() {
        if (!this.initialized) return;
        const t   = this.ctx.currentTime;
        [392, 523.25].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const env = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t + i * 0.05);
            applyADSR(env, this.ctx, t + i * 0.05, 0.16, 0.008, 0.04, 0.2, 0.10);
            osc.connect(env);
            env.connect(this.channels.lulu);
            osc.start(t + i * 0.05);
            osc.stop(t + i * 0.05 + 0.20);
        });
    }

    // ═════════════════════════════════════════════════════════════════════════
    // CAPA 3 — NAVEGACIÓN / WARP
    // ═════════════════════════════════════════════════════════════════════════

    /** Iniciación de viaje de precisión — confirmación breve */
    _playWarpInitiate() {
        if (!this.initialized) return;
        const t    = this.ctx.currentTime;
        const freqs = [220, 330, 440, 660];
        freqs.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const env = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t + i * 0.055);
            applyADSR(env, this.ctx, t + i * 0.055, 0.24, 0.01, 0.06, 0.3, 0.22);
            osc.connect(env);
            env.connect(this.channels.sfx);
            osc.start(t + i * 0.055);
            osc.stop(t + i * 0.055 + 0.40);
        });
    }

    /** Spool de Warp — oscilador persistente que sube de frecuencia */
    _playWarpSpool() {
        if (!this.initialized || this._warpActive) return;
        this._warpActive = true;

        const t   = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();

        // Ruido de spool: frecuencia sube de 40Hz a 280Hz en 2.4s
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(40, t);
        osc.frequency.exponentialRampToValueAtTime(280, t + 2.4);

        // Fade-in gradual
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(0.45, t + 0.35);
        env.gain.setValueAtTime(0.45, t + 2.0);
        env.gain.linearRampToValueAtTime(0.0001, t + 2.4);

        // Filtro pasa-bajos para calidez
        const filter = this.ctx.createBiquadFilter();
        filter.type            = 'lowpass';
        filter.frequency.value = 1200;
        filter.Q.value         = 2.5;

        osc.connect(filter);
        filter.connect(env);
        env.connect(this.channels.sfx);

        osc.start(t);
        osc.stop(t + 2.6);
        osc.onended = () => { this._warpActive = false; };

        this._warpOscillator = osc;
        this._warpGainNode   = env;
    }

    /** Salida del Warp — dropout de frecuencia aguda */
    _playWarpDropout() {
        if (!this.initialized) return;
        this._warpActive = false;

        const t   = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.exponentialRampToValueAtTime(55, t + 0.65);

        applyADSR(env, this.ctx, t, 0.50, 0.02, 0.10, 0.4, 0.55);

        osc.connect(env);
        env.connect(this.channels.sfx);
        osc.start(t);
        osc.stop(t + 0.90);
    }

    /** Auto-freno engranado — pulso de desceleración */
    _playBrake() {
        if (!this.initialized) return;
        const t   = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.linearRampToValueAtTime(110, t + 0.2);
        applyADSR(env, this.ctx, t, 0.30, 0.01, 0.08, 0.1, 0.18);
        osc.connect(env);
        env.connect(this.channels.sfx);
        osc.start(t);
        osc.stop(t + 0.32);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // CAPA 4 — BALÍSTICA (INJ)
    // ═════════════════════════════════════════════════════════════════════════

    /** Lanzamiento del enjambre de partículas */
    _playSwarmLaunch() {
        if (!this.initialized) return;
        const t = this.ctx.currentTime;

        // Burst de ruido blanco — sensación de enjambre saliendo
        const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.4, this.ctx.sampleRate);
        const nd = noiseBuffer.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

        const noiseSrc = this.ctx.createBufferSource();
        noiseSrc.buffer = noiseBuffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type            = 'bandpass';
        noiseFilter.frequency.value = 3200;
        noiseFilter.Q.value         = 1.8;

        const noiseEnv = this.ctx.createGain();
        noiseEnv.gain.setValueAtTime(0, t);
        noiseEnv.gain.linearRampToValueAtTime(0.60, t + 0.02);
        noiseEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.40);

        noiseSrc.connect(noiseFilter);
        noiseFilter.connect(noiseEnv);
        noiseEnv.connect(this.channels.sfx);
        noiseSrc.start(t);

        // Tono grave de propulsión encima del ruido
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, t);
        osc.frequency.exponentialRampToValueAtTime(320, t + 0.22);
        applyADSR(env, this.ctx, t, 0.38, 0.01, 0.05, 0.2, 0.20);
        osc.connect(env);
        env.connect(this.channels.sfx);
        osc.start(t);
        osc.stop(t + 0.38);
    }

    /** Impacto balístico — scar comprometido en el planeta */
    _playImpact() {
        if (!this.initialized) return;
        const t = this.ctx.currentTime;

        // Ruido de impacto grave (body hit)
        const dur    = 0.55;
        const frames = Math.ceil(this.ctx.sampleRate * dur);
        const buf    = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
        const bd     = buf.getChannelData(0);
        for (let i = 0; i < frames; i++) bd[i] = Math.random() * 2 - 1;

        const src = this.ctx.createBufferSource();
        src.buffer = buf;

        const filter = this.ctx.createBiquadFilter();
        filter.type            = 'lowpass';
        filter.frequency.value = 220;
        filter.Q.value         = 4.0;

        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0.80, t);
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        src.connect(filter);
        filter.connect(env);
        env.connect(this.channels.sfx);
        src.start(t);

        // Tono resonante de impacto (metallic ping)
        const ping = this.ctx.createOscillator();
        const pingEnv = this.ctx.createGain();
        ping.type = 'sine';
        ping.frequency.setValueAtTime(140, t);
        ping.frequency.exponentialRampToValueAtTime(55, t + 0.45);
        applyADSR(pingEnv, this.ctx, t, 0.50, 0.003, 0.05, 0.3, 0.42);
        ping.connect(pingEnv);
        pingEnv.connect(this.channels.sfx);
        ping.start(t);
        ping.stop(t + 0.55);
    }

    // ── API pública ───────────────────────────────────────────────────────────

    /** Ajusta el volumen maestro en tiempo real (0.0 - 1.0) */
    setMasterVolume(value) {
        if (!this.initialized || !this.masterGain) return;
        const v = Math.max(0, Math.min(1, value));
        this.masterGain.gain.setTargetAtTime(v * MASTER_VOLUME, this.ctx.currentTime, 0.05);
    }

    /** Ajusta el volumen de un canal específico */
    setChannelVolume(channelName, value) {
        if (!this.initialized || !this.channels?.[channelName]) return;
        const v = Math.max(0, Math.min(1, value));
        this.channels[channelName].gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    }

    /** Estado para DevTools */
    getDebugState() {
        return {
            initialized:  this.initialized,
            ctxState:     this.ctx?.state ?? 'none',
            warpActive:   this._warpActive,
            masterVolume: this.masterGain?.gain.value ?? 0,
        };
    }

    destroy() {
        this._signalRemovers.forEach(fn => { try { fn?.(); } catch (_) { /* */ } });
        this._signalRemovers.length = 0;
        try {
            this._ambienceSourceNode?.stop();
            this._warpOscillator?.stop();
        } catch (_) { /* ya detenidos */ }
        this.ctx?.close().catch(() => {});
    }
}

export default AudioEngine;
