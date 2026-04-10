import { Registry } from '../core/ServiceRegistry.js';
import { gsap } from 'gsap';

/**
 * BubbleLauncher.js
 * OMEGA V28 Master Edition — Workspace & UI
 */
export class BubbleLauncher {
    static phase = 'workspace';
    constructor(services) {
        this.services = services;
        this.container = null;
        this.input = null;
        this.mode = 'url';
    }

    init() {
        console.log('[BubbleLauncher] OMEGA Quick-Action Core Online.');
        this.registry = Registry.get('registry');
        this.events = Registry.get('events');
        this.createLauncherUI();
        this.events.on('frame:end', ({ delta }) => this.update(delta));
    }

    createLauncherUI() {
        this.container = document.createElement('div');
        this.container.id = 'bubble-launcher-container';
        
        // Match the container-less, floating sensitivo style
        this.container.style.cssText = `
            position: fixed;
            bottom: 40px;
            left: 40px;
            display: flex;
            align-items: center;
            gap: 15px;
            z-index: 9999;
            pointer-events: auto;
        `;

        const plusBtn = document.createElement('button');
        plusBtn.className = 'btn-glass-circle';
        plusBtn.innerHTML = '+';
        plusBtn.style.cssText = `
            width: 50px; height: 50px;
            border-radius: 50%; font-size: 24px;
            background: rgba(0, 136, 255, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 0 30px rgba(0, 136, 255, 0.3);
            color: white; transform-origin: center;
        `;

        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.placeholder = 'Paste URL...';
        this.input.style.cssText = `
            width: 0px; opacity: 0;
            padding: 12px 0px; border-radius: 25px;
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(25px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: white; outline: none;
            font-family: 'Inter', sans-serif;
            transition: all 0.6s cubic-bezier(0.19, 1, 0.22, 1);
        `;

        plusBtn.onclick = () => this.toggleInput();

        this.input.onkeydown = (e) => {
            if (e.key === 'Enter' && this.input.value) {
                this.launchBubble(this.input.value);
                this.input.value = '';
                this.toggleInput();
            }
        };

        this.container.appendChild(plusBtn);
        this.container.appendChild(this.input);
        document.body.appendChild(this.container);
    }

    update(delta) {
        // This method is now called on each frame:end event.
        // It can be used for any continuous updates needed by the launcher.
        // For example, if the launcher needed to react to world state changes.
        // Currently, it doesn't perform any specific action.
    }

    toggleInput() {
        const interaction =
            Registry.tryGet('InteractionSystem') ||
            Registry.tryGet('WorldInteractionSystem') ||
            window.engine?.interactionSystem ||
            null;
        const activeTarget = interaction?.getActiveTarget?.() || null;
        const isOpen = this.input.style.width !== '0px';

        if (!isOpen) {
            if (interaction?.focusedMoon || activeTarget?.userData?.isMetamorphMoon || activeTarget?.userData?.nodeType === 'metamorph-moon') {
                this.input.placeholder = 'Write Note...';
                this.mode = 'note';
            } else if (
                interaction?.focusedSun ||
                activeTarget?.userData?.nodeType === 'star' ||
                activeTarget?.userData?.nodeType === 'planet'
            ) {
                this.input.placeholder = 'Paste URL...';
                this.mode = 'url';
            } else {
                console.log('[BubbleLauncher] Focus required (Sun or Moon).');
                // Could pulse the UI to indicate focus is needed
                return;
            }

            this.input.style.width = '300px';
            this.input.style.paddingLeft = '20px';
            this.input.style.paddingRight = '20px';
            this.input.style.opacity = '1';
            this.input.focus();
        } else {
            this.input.style.width = '0px';
            this.input.style.paddingLeft = '0px';
            this.input.style.paddingRight = '0px';
            this.input.style.opacity = '0';
        }
    }

    launchBubble(content) {
        const isUrl = this.mode === 'url';
        
        // 1. Viscous Detachment Bubble
        const bubble = document.createElement('div');
        const color = isUrl ? 'rgba(0, 240, 255, 0.8)' : 'rgba(255, 240, 0, 0.8)'; // Cyan for URL, Yellow for Note
        bubble.style.cssText = `
            position: fixed;
            left: 50px;
            bottom: 60px;
            width: 40px; height: 40px;
            background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.6), ${color});
            border-radius: 50%;
            z-index: 10000;
            backdrop-filter: blur(10px);
            box-shadow: 0 0 50px ${color};
            pointer-events: none;
        `;
        document.body.appendChild(bubble);

        // 2. The Silicone Sequence (Stretch -> Snap -> Birth)
        const tl = gsap.timeline();
        
        tl.to(bubble, {
            scaleY: 1.3,
            scaleX: 0.85,
            y: -40,
            duration: 0.4,
            ease: "power2.inOut"
        })
        .to(bubble, {
            scale: 1.1,
            y: -400, // Float up into workspace
            duration: 1.2,
            ease: "expo.out",
            onStart: () => {
                // Harmonic detach wobble
                gsap.to(bubble, { scaleX: 1.2, scaleY: 0.8, duration: 0.15, repeat: 1, yoyo: true });
            },
            onComplete: () => {
                if (!this.events?.emit) {
                    bubble.remove();
                    return;
                }

                if (isUrl) {
                    if (!content.startsWith('http')) content = 'https://' + content;
                    this.events.emit('system:spawn-protostar', {
                        url: content,
                        screenX: 60,
                        screenY: window.innerHeight - 60
                    });
                } else {
                    this.events.emit('system:spawn-note', {
                        text: content,
                        screenX: 60,
                        screenY: window.innerHeight - 60
                    });
                }
                
                // Final expansion "pop" into window
                gsap.to(bubble, { 
                    scale: 3, 
                    opacity: 0, 
                    duration: 0.5, 
                    ease: "power2.out",
                    onComplete: () => bubble.remove() 
                });
            }
        });
    }
}
