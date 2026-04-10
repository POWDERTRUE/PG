import gsap from "gsap";

export class WorkspaceManager {
    constructor(source = 'window-layer') {
        this.windowManager = this._resolveWindowManager(source);
        this.layer = this._resolveLayer(source);
        this.isModular = false;
        this.spatialMemory = new WeakMap();
    }

    _resolveWindowManager(source) {
        if (source?.getWorkspaceWindows && source?.getWindowLayer) {
            return source;
        }
        if (source?.domSystem?.getWorkspaceWindows) {
            return source;
        }
        return null;
    }

    _resolveLayer(source) {
        if (source?.nodeType === 1) {
            return source;
        }
        if (source?.getWindowLayer) {
            return source.getWindowLayer();
        }
        if (source?.domSystem?.container) {
            return source.domSystem.container;
        }
        if (typeof source === 'string') {
            return document.getElementById(source);
        }
        return document.getElementById('window-layer');
    }

    _getManagedWindows() {
        const managerWindows = this.windowManager?.getWorkspaceWindows?.();
        if (Array.isArray(managerWindows) && managerWindows.length > 0) {
            return managerWindows;
        }
        if (!this.layer) {
            return [];
        }
        const rawWindows = Array.from(this.layer.querySelectorAll('.glass-window, .os-window, #lulu-panel, #lulu-response-panel'));
        return rawWindows.filter((win) => window.getComputedStyle(win).display !== 'none');
    }

    toggleMissionControl() {
        if (!this.layer) return;

        const windows = this._getManagedWindows();
        if (windows.length === 0) return;

        const firstStates = windows.map((win) => win.getBoundingClientRect());
        this.isModular = !this.isModular;

        if (this.isModular) {
            windows.forEach((win, index) => {
                this.spatialMemory.set(win, {
                    left: win.style.left,
                    top: win.style.top,
                    right: win.style.right,
                    bottom: win.style.bottom,
                    width: win.style.width,
                    height: win.style.height,
                    zIndex: win.style.zIndex,
                    position: win.style.position
                });

                win.classList.add('modular-slot');
                win.dataset.modularColumn = index % 2 === 0 ? 'left' : 'right';

                if (win.id === 'lulu-panel' || win.id === 'lulu-response-panel' || win.classList.contains('lulu-telemetry')) {
                    win.classList.add('lulu-priority');
                    win.dataset.modularColumn = 'right';
                }
            });

            this.layer.classList.add('modular-mode');
            gsap.to(this.layer, {
                backdropFilter: "blur(5px)",
                backgroundColor: "rgba(0, 0, 0, 0.3)",
                duration: 0.5,
                ease: "power2.out"
            });
        } else {
            this.layer.classList.remove('modular-mode');
            gsap.to(this.layer, {
                backdropFilter: "blur(0px)",
                backgroundColor: "rgba(0, 0, 0, 0)",
                duration: 0.4,
                ease: "power2.in"
            });

            windows.forEach((win) => {
                win.classList.remove('modular-slot', 'lulu-priority');
                delete win.dataset.modularColumn;

                const memory = this.spatialMemory.get(win);
                win.style.position = memory?.position || 'absolute';

                if (memory) {
                    win.style.left = memory.left;
                    win.style.top = memory.top;
                    win.style.right = memory.right;
                    win.style.bottom = memory.bottom;
                    win.style.width = memory.width;
                    win.style.height = memory.height;
                    win.style.zIndex = memory.zIndex;
                }
            });
        }

        this.layer.getBoundingClientRect();
        const lastStates = windows.map((win) => win.getBoundingClientRect());

        windows.forEach((win, index) => {
            const first = firstStates[index];
            const last = lastStates[index];

            const deltaX = first.left - last.left;
            const deltaY = first.top - last.top;
            const deltaWidth = first.width / (last.width || 1);
            const deltaHeight = first.height / (last.height || 1);

            gsap.set(win, {
                x: deltaX,
                y: deltaY,
                scaleX: deltaWidth,
                scaleY: deltaHeight,
                transformOrigin: "top left"
            });

            gsap.to(win, {
                x: 0,
                y: 0,
                scaleX: 1,
                scaleY: 1,
                duration: 0.7,
                ease: "expo.inOut",
                onComplete: () => {
                    gsap.set(win, { clearProps: "transform,scaleX,scaleY" });
                }
            });
        });
    }
}

export default WorkspaceManager;
