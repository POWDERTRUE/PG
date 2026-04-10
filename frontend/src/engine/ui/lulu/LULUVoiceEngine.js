/**
 * LULUVoiceEngine.js — OMEGA V30
 * Web Speech API wrapper: text-to-speech synthesis + voice recognition.
 * Designed as a space-computer voice: Spanish, low pitch, deliberate pace.
 */
export class LULUVoiceEngine {
    constructor(processor, responsePanel) {
        this.processor     = processor;
        this.responsePanel = responsePanel;
        this._muted        = false;
        this._ready        = false;
        this._recognition  = null;
        this._listening    = false;

        this._initSynthesis();
    }

    // ── Synthesis (TTS) ───────────────────────────────────────────────────────

    _initSynthesis() {
        if (!window.speechSynthesis) { console.warn('[LULUVoice] TTS not supported.'); return; }

        // Voices may load async — wait for them
        const load = () => {
            this._voices = window.speechSynthesis.getVoices();
            this._preferred = this._pickVoice();
            this._ready = true;
            console.log(`[LULUVoice] TTS ready. Voice: ${this._preferred?.name ?? 'default'}`);
        };

        if (window.speechSynthesis.getVoices().length) {
            load();
        } else {
            window.speechSynthesis.addEventListener('voiceschanged', load, { once: true });
        }
    }

    _pickVoice() {
        const voices = window.speechSynthesis.getVoices();
        // Priority: Spanish female > Spanish any > first available
        return voices.find(v => v.lang === 'es-ES' && /female|mujer|femenin/i.test(v.name))
            || voices.find(v => v.lang.startsWith('es'))
            || voices[0]
            || null;
    }

    /**
     * Speak text if not muted.
     * @param {string} text
     * @param {{ rate?:number, pitch?:number }} opts
     */
    speak(text, { rate = 0.90, pitch = 0.80 } = {}) {
        if (this._muted || !this._ready || !window.speechSynthesis) return;
        // Cancel any ongoing speech so it doesn't queue forever
        window.speechSynthesis.cancel();

        const utt  = new SpeechSynthesisUtterance(text);
        utt.lang   = 'es-ES';
        utt.rate   = rate;
        utt.pitch  = pitch;
        if (this._preferred) utt.voice = this._preferred;

        window.speechSynthesis.speak(utt);
    }

    /**
     * Called by LULUResponsePanel when voiceEngine is set.
     * Short messages only (< 80 chars, non-system).
     */
    speakIfActive(text) {
        if (text.length > 80) return; // Don't read long diagnostic dumps
        this.speak(text);
    }

    mute()   { this._muted = true;  window.speechSynthesis?.cancel(); }
    unmute() { this._muted = false; }
    get isMuted() { return this._muted; }

    // ── Recognition (STT) ─────────────────────────────────────────────────────

    startListening() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            this.responsePanel.log('Reconocimiento de voz no disponible en este navegador.', 'warn');
            return;
        }
        if (this._listening) { this.stopListening(); return; }

        this._recognition = new SR();
        this._recognition.lang            = 'es-ES';
        this._recognition.continuous      = false;
        this._recognition.interimResults  = false;
        this._recognition.maxAlternatives = 1;

        this._recognition.onstart = () => {
            this._listening = true;
            this.responsePanel.log('Escuchando…', 'system');
            this._updateMicButton(true);
        };

        this._recognition.onresult = (e) => {
            const transcript = e.results[0][0].transcript;
            this.responsePanel.log(`[voz] ${transcript}`, 'info');
            this.processor.process(transcript);
        };

        this._recognition.onerror = (e) => {
            this.responsePanel.log(`Error de voz: ${e.error}`, 'error');
            this._stopState();
        };

        this._recognition.onend = () => this._stopState();

        this._recognition.start();
    }

    stopListening() {
        this._recognition?.stop();
        this._stopState();
    }

    _stopState() {
        this._listening = false;
        this._updateMicButton(false);
    }

    _updateMicButton(active) {
        const btn = document.getElementById('lulu-mic-btn');
        if (btn) btn.classList.toggle('lulu-listening', active);
    }

    dispose() {
        this._recognition?.abort();
        window.speechSynthesis?.cancel();
    }
}
