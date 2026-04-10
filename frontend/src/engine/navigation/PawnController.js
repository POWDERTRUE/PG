import { Registry } from "../core/ServiceRegistry.js";

export class PawnController {
    static dependencies = ["kernel"];

    constructor(kernel) {
        this.kernel = kernel || window.engine;
        this._skipSelfRegister = !!kernel;
        this.registry = window.Registry || (this.kernel ? this.kernel.registry : null);
        
        this.pawn = null;
        this.mode = "none";
        this.context = null;

        this.registryDeps();
    }

    registryDeps() {
        if (!this.registry) return;
        if (window.Registry && !window.Registry.tryGet?.("pawnController") && !this._skipSelfRegister) {
            window.Registry.register("pawnController", this);
        }
    }

    setPawn(object, options = {}) {
        this.pawn = object;
        this.mode = object ? (options.mode || "sandbox") : "none";
        this.context = object ? { ...options } : null;
        if (object) {
            console.log("[PawnController] Avatar set:", object.name || "Unknown Mass");
        } else {
            console.log("[PawnController] Avatar cleared");
        }
    }

    getPawn() {
        return this.pawn;
    }

    getMode() {
        return this.mode;
    }

    getContext() {
        return this.context;
    }

    shouldDriveCamera() {
        return !!this.pawn && this.mode === "sandbox";
    }

    shouldOrientToAim() {
        return !!this.pawn && this.mode === "sandbox";
    }
}
