import gsap from 'https://unpkg.com/gsap@3.12.5/index.js';

/**
 * ==========================================================
 * Powder Galaxy Engine - Dashboard V28 (OMEGA)
 * ==========================================================
 * @file Dashboard.js
 * @description V38 System OS Command Center
 */
export class Dashboard {
    constructor() {
        this.container = document.getElementById('hud-layer');
        this.element = null;
        this.isActive = false;
        this.kernel = null;
    }

    render(kernel) {
        if (!this.container) return;
        this.kernel = kernel;

        this.element = document.createElement('div');
        this.element.id = 'system-dashboard';
        this.element.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(50px) saturate(200%);
            -webkit-backdrop-filter: blur(50px) saturate(200%);
            z-index: 5000;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        `;

        this.element.innerHTML = `
            <div class="glass-capsule-premium" style="width: 80vw; height: 70vh; display: flex; flex-direction: column; padding: 40px; transform: scale(0.95);">
                <div class="glass-refraction-overlay"></div>
                
                <header style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px;">
                    <div>
                        <h1 style="margin: 0; font-family: 'Inter', sans-serif; font-weight: 200; letter-spacing: 12px; font-size: 32px; color: #fff;">OS DASHBOARD</h1>
                        <p style="margin: 8px 0 0; color: rgba(0, 240, 255, 0.6); font-size: 10px; font-weight: 800; text-transform: uppercase;">Powder Galaxy V28 OMEGA</p>
                    </div>
                    <button id="close-dash" class="window-btn close" style="width: 24px; height: 24px;"></button>
                </header>

                <div style="flex-grow: 1; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px;">
                    <!-- Module 1: Universe -->
                    <div class="glass-capsule-premium" style="padding: 25px; background: rgba(255, 255, 255, 0.02);">
                        <h3 style="margin: 0 0 20px; font-size: 12px; color: rgba(255,255,255,0.5); letter-spacing: 1px;">UNIVERSE STATUS</h3>
                        <div style="display: flex; flex-direction: column; gap: 15px;">
                            <div style="display: flex; justify-content: space-between;">
                                <span style="font-size: 11px; color: rgba(255,255,255,0.4);">LOD MESHES</span>
                                <span style="font-size: 11px; color: #fff;">ACTIVE (V28)</span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span style="font-size: 11px; color: rgba(255,255,255,0.4);">STAR KERNEL</span>
                                <span style="font-size: 11px; color: #00f0ff;">RUNNING (1M)</span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span style="font-size: 11px; color: rgba(255,255,255,0.4);">FLOATING ORIGIN</span>
                                <span style="font-size: 11px; color: #fff;">STABLE (64-BIT)</span>
                            </div>
                        </div>
                    </div>

                    <!-- Module 2: Hardware -->
                    <div class="glass-capsule-premium" style="padding: 25px; background: rgba(255, 255, 255, 0.02);">
                        <h3 style="margin: 0 0 20px; font-size: 12px; color: rgba(255,255,255,0.5); letter-spacing: 1px;">ENGINE TELEMETRY</h3>
                        <div style="margin-top: 15px; display: flex; flex-direction: column; gap: 10px;">
                            <div style="height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
                                <div style="width: 45%; height: 100%; background: #00f0ff;"></div>
                            </div>
                            <span style="font-size: 9px; color: rgba(255,255,255,0.3);">GPU MEMORY: OPTIMIZED</span>
                        </div>
                    </div>

                    <!-- Module 3: System Logs -->
                    <div class="glass-capsule-premium" style="padding: 25px; background: rgba(255, 255, 255, 0.02); display: flex; flex-direction: column;">
                        <h3 style="margin: 0 0 20px; font-size: 12px; color: rgba(255,255,255,0.5); letter-spacing: 1px;">SYSTEM LOGS</h3>
                        <div id="dash-logs" style="flex-grow: 1; font-family: monospace; font-size: 10px; color: rgba(0, 240, 255, 0.4); overflow: hidden;">
                            [01:10] OMEGA V28 Heartbeat Stable.<br/>
                            [01:10] Identity Verified.<br/>
                            [01:10] Spatial Index Active.<br/>
                            [01:11] 1M Stars Allocated to GPU.
                        </div>
                    </div>
                </div>

                <footer style="margin-top: 40px; display: flex; justify-content: center;">
                    <button class="glass-btn-premium" style="padding: 10px 40px;" id="reboot-btn">OS REBOOT</button>
                </footer>
            </div>
        `;

        this.container.appendChild(this.element);
        this.bindEvents();
    }

    bindEvents() {
        this.element.querySelector('#close-dash').onclick = () => this.toggle(false);
        this.element.querySelector('#reboot-btn').onclick = () => window.location.reload();
        
        if (this.kernel && this.kernel.events) {
            this.kernel.events.on('os:toggle_dashboard', () => this.toggle());
        }
    }

    toggle(state = !this.isActive) {
        this.isActive = state;
        if (this.isActive) {
            this.element.style.opacity = '1';
            this.element.style.pointerEvents = 'auto';
            gsap.fromTo(this.element.querySelector('.glass-capsule-premium'), 
                { scale: 0.95, y: 20 }, 
                { scale: 1, y: 0, duration: 0.8, ease: "expo.out" }
            );
        } else {
            this.element.style.opacity = '0';
            this.element.style.pointerEvents = 'none';
        }
    }
}

