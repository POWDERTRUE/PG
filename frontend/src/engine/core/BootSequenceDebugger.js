/**
 * BootSequenceDebugger.js
 * OMEGA Engine – Boot Profiler
 *
 * Measures system initialization performance during engine boot.
 * Designed to integrate with BootSequence.
 */

export class BootSequenceDebugger {

    static records = [];
    static startTime = 0;

    /**
     * Called when boot begins
     */
    static begin() {
        this.records = [];
        this.startTime = performance.now();

        console.group(
            "%c🚀 OMEGA Boot Profiler",
            "background:#111;color:#00eaff;font-weight:bold"
        );
    }

    /**
     * Measure execution time of a system init
     */
    static async measure(systemName, fn) {
        const t0 = performance.now();
        await fn();
        const t1 = performance.now();

        const duration = t1 - t0;
        this.records.push({
            system: systemName,
            time: duration
        });
    }

    /**
     * Called when boot completes
     */
    static end() {
        const total = performance.now() - this.startTime;

        const table = this.records.map((r, i) => ({
            Step: i + 1,
            System: r.system,
            InitTimeMS: r.time.toFixed(2)
        }));

        console.table(table);

        const slow = [...this.records]
            .sort((a,b)=>b.time-a.time)
            .slice(0,5);

        console.group(
            "%c🐢 Slowest Systems",
            "color:#ffaa00;font-weight:bold"
        );

        slow.forEach(s => {
            console.log(
                `%c${s.system} → ${s.time.toFixed(2)} ms`,
                "color:#ffaa00"
            );
        });

        console.groupEnd();

        console.log(
            `%cTotal Boot Time → ${total.toFixed(2)} ms`,
            "color:#00ff9c;font-weight:bold"
        );

        console.groupEnd();
    }

    /**
     * Return profiling data programmatically
     */
    static getReport() {
        const total = this.records.reduce((a,b)=>a+b.time,0);

        return {
            totalBootTime: total,
            systems: this.records
        };
    }
}
