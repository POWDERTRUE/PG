export class RuntimeSignals {
    constructor({ events = null, dispatchTarget = null } = {}) {
        this.events = events;
        this.dispatchTarget = dispatchTarget ?? (typeof window !== 'undefined' ? window : null);
    }

    emit(name, detail = {}, options = {}) {
        const { mirrorDom = true, bubbles = false } = options;
        this.events?.emit?.(name, detail);

        if (mirrorDom && this.dispatchTarget?.dispatchEvent) {
            this.dispatchTarget.dispatchEvent(new CustomEvent(name, {
                detail,
                bubbles,
            }));
        }
    }

    on(name, callback) {
        if (!name || typeof callback !== 'function') {
            return () => {};
        }
        this.events?.on?.(name, callback);
        return () => this.off(name, callback);
    }

    once(name, callback) {
        if (!name || typeof callback !== 'function') {
            return () => {};
        }
        let remove = () => {};
        const wrapped = (payload) => {
            remove();
            callback(payload);
        };
        remove = this.on(name, wrapped);
        return remove;
    }

    off(name, callback) {
        this.events?.off?.(name, callback);
    }
}

export default RuntimeSignals;
