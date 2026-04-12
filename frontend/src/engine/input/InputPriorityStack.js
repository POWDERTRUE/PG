export class InputPriorityStack {
    constructor() {
        this.stack = ["FLIGHT"];
        this.listeners = [];
    }

    push(state) {
        if (this.stack[this.stack.length - 1] === state) return;
        this.stack.push(state);
        this.emit();
    }

    pop() {
        if (this.stack.length <= 1) return;
        this.stack.pop();
        this.emit();
    }

    current() {
        return this.stack[this.stack.length - 1];
    }

    subscribe(callback) {
        this.listeners.push(callback);
    }

    emit() {
        const state = this.current();
        this.listeners.forEach(cb => cb(state));
    }
}
