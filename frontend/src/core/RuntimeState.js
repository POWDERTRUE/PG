export class RuntimeState {
    constructor({ events = null } = {}) {
        this.events = events;
        this.state = {
            loginActive: false,
            gamePaused: false,
            settings: null,
        };
        this._legacyBridgeInstalled = false;
    }

    installLegacyBridge() {
        if (this._legacyBridgeInstalled || typeof window === 'undefined') {
            return;
        }

        this._defineLegacyProperty('__loginActive', {
            get: () => this.isLoginActive(),
            set: (value) => {
                this.state.loginActive = !!value;
            }
        });

        this._defineLegacyProperty('__gamePaused', {
            get: () => this.isGamePaused(),
            set: (value) => {
                this.state.gamePaused = !!value;
            }
        });

        this._defineLegacyProperty('__PG_SETTINGS', {
            get: () => this.getSettings(),
            set: (value) => {
                this.state.settings = this._clone(value);
            }
        });

        this._legacyBridgeInstalled = true;
    }

    _defineLegacyProperty(name, descriptor) {
        Object.defineProperty(window, name, {
            configurable: true,
            enumerable: false,
            get: descriptor.get,
            set: descriptor.set,
        });
    }

    setLoginActive(active, metadata = {}) {
        this.state.loginActive = !!active;
        this._emit('RUNTIME_LOGIN_STATE', { active: this.state.loginActive, ...metadata });
        return this.state.loginActive;
    }

    isLoginActive() {
        return !!this.state.loginActive;
    }

    setGamePaused(active, metadata = {}) {
        this.state.gamePaused = !!active;
        this._emit('RUNTIME_GAME_PAUSED', { active: this.state.gamePaused, ...metadata });
        return this.state.gamePaused;
    }

    isGamePaused() {
        return !!this.state.gamePaused;
    }

    setSettings(settings, metadata = {}) {
        this.state.settings = this._clone(settings);
        this._emit('RUNTIME_SETTINGS_UPDATED', { settings: this.getSettings(), ...metadata });
        return this.getSettings();
    }

    getSettings() {
        return this._clone(this.state.settings);
    }

    getGameplaySettings() {
        return this.getSettings()?.gameplay ?? {};
    }

    snapshot() {
        return {
            loginActive: this.isLoginActive(),
            gamePaused: this.isGamePaused(),
            settings: this.getSettings(),
        };
    }

    _emit(eventName, payload) {
        this.events?.emit?.(eventName, payload);
    }

    _clone(value) {
        if (value == null) return value;
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (_) {
            return value;
        }
    }
}

export default RuntimeState;
