import { gsap } from 'gsap';
import { Registry } from '../../core/ServiceRegistry.js';
import {
    CONTROL_CATEGORY,
    CONTROL_SECTION_ORDER,
    formatControlKeys,
    getControlsByCategory,
} from '../../input/ControlsManifest.js';

const buildQuickReference = () => CONTROL_SECTION_ORDER
    .filter((category) => category !== CONTROL_CATEGORY.DEBUG)
    .map((category) => {
        const controls = getControlsByCategory(category);
        if (!controls.length) return '';

        const rows = controls
            .map((control) => `
                <li style="margin-bottom: 8px;">
                    <strong style="color:#fff;">${control.label}:</strong>
                    <span>${formatControlKeys(control)}.</span>
                    <span style="color:#8fdfff;"> ${control.description}</span>
                </li>
            `)
            .join('');

        return `<ul style="color: #aaa; padding-left: 20px; margin-top: 10px;">${rows}</ul>`;
    })
    .join('');

const buildManualHtml = () => `
<div style="font-family: 'Courier New', monospace; color: #fff; padding: 20px; line-height: 1.6;">
    <h2 style="color: #00e5ff; border-bottom: 1px solid rgba(0,229,255,0.3); padding-bottom: 10px; margin-top: 0;">MANUAL DEL JUGADOR - OMEGA V31</h2>

    <h3 style="color: #ffaa00;">1. Arranque canonico</h3>
    <p>El flujo real inicia en el selector de perfil. Al entrar por <b>PUBLICO</b>, el universo salta a <b>FREE_FLIGHT</b>, recoloca el rig de camara sobre la galaxia y activa <b>pointer lock</b>. Si lo pierdes, basta con hacer click sobre el canvas para recuperarlo.</p>

    <h3 style="color: #ffaa00;">2. Vuelo libre</h3>
    <p>FREE_FLIGHT funciona como un dron 6DoF. El mouse rota la vista mientras el puntero esta bloqueado, el rig mantiene banking cosmetico al strafear y el FOV respira segun la velocidad.</p>
    <p><b>Tab</b> alterna el visor contextual: suelta el pointer lock, muestra el cursor real y congela la navegacion hasta que regreses. <b>Esc</b> ya no expulsa del modo actual; ahora abre o cierra la pausa tactica <b>Omega Vista</b>.</p>

    <h3 style="color: #ffaa00;">3. Focus, mapa y descenso</h3>
    <p>Cuando una masa queda enfocada, la camara pasa a <b>FOCUS</b>. Desde ahi puedes orbitar, usar la rueda para zoom, abrir el mapa contextual con <b>M</b> y, si estas dentro del umbral orbital, iniciar descenso con <b>L</b>.</p>

    <h3 style="color: #ffaa00;">4. Cockpit</h3>
    <p><b>C</b> entra y sale del modo <b>COCKPIT</b>. El HUD de cabina muestra SPD, ALT, HDG, ROLL y PITCH. La salida real del cockpit tambien es <b>C</b>; <b>Esc</b> sigue reservado para la pausa.</p>

    <h3 style="color: #ffaa00;">5. Referencia rapida sincronizada</h3>
    ${buildQuickReference()}

    <h3 style="color: #ffaa00;">6. Poderes LULU</h3>
    <p>LULU ya no se limita a primitivas. Puedes pedir <b style="color:#00e5ff">"crear planeta volcanico"</b>, <b style="color:#00e5ff">"crear estrella azul"</b>, <b style="color:#00e5ff">"crear nebulosa cyan"</b> o <b style="color:#00e5ff">"crear agujero negro"</b>. Tambien puedes pedir <b style="color:#00e5ff">"estado del universo"</b>, <b style="color:#00e5ff">"encuadra galaxia"</b> o <b style="color:#00e5ff">"docs galaxia"</b>.</p>

    <div style="margin-top: 40px; text-align: center; color: rgba(255,255,255,0.3); font-size: 11px; letter-spacing: 1px;">
        [ DOC_ID: LULU_MANUAL_SYSTEM | CONTROLS SOURCE: frontend/src/engine/input/ControlsManifest.js ]
    </div>
</div>
`;

export class LULUManualSystem {
    static open() {
        if (document.getElementById('lulu-manual-panel')) return;

        Registry.tryGet('PointerPresentationController')
            ?.releasePointerLock?.({ reason: 'lulu-manual-open' });

        const panel = document.createElement('div');
        panel.id = 'lulu-manual-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.9);
            width: 760px;
            max-width: 90vw;
            max-height: 80vh;
            overflow-y: auto;
            background: rgba(8, 12, 18, 0.95);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(0, 229, 255, 0.3);
            border-radius: 12px;
            z-index: 100000;
            box-shadow: 0 20px 60px rgba(0, 229, 255, 0.1);
            pointer-events: auto;
            opacity: 0;
            cursor: default;
        `;
        panel.addEventListener('wheel', (event) => {
            event.stopPropagation();
        }, { passive: true });

        const style = document.createElement('style');
        style.innerText = `
            #lulu-manual-panel::-webkit-scrollbar { width: 8px; }
            #lulu-manual-panel::-webkit-scrollbar-track { background: rgba(0,0,0,0.5); border-radius: 4px; }
            #lulu-manual-panel::-webkit-scrollbar-thumb { background: rgba(0, 229, 255, 0.3); border-radius: 4px; }
            #lulu-manual-panel::-webkit-scrollbar-thumb:hover { background: rgba(0, 229, 255, 0.6); }
        `;
        document.head.appendChild(style);

        panel.innerHTML = buildManualHtml();

        const closeBtn = document.createElement('button');
        closeBtn.innerText = 'X';
        closeBtn.style.cssText = `
            position: absolute;
            top: 15px;
            right: 15px;
            background: rgba(255, 0, 80, 0.1);
            border: 1px solid rgba(255, 0, 80, 0.4);
            color: #ff3366;
            font-family: sans-serif;
            font-size: 14px;
            font-weight: bold;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        closeBtn.onmouseenter = () => {
            closeBtn.style.background = 'rgba(255, 0, 80, 0.4)';
            closeBtn.style.transform = 'scale(1.1)';
        };
        closeBtn.onmouseleave = () => {
            closeBtn.style.background = 'rgba(255, 0, 80, 0.1)';
            closeBtn.style.transform = 'scale(1)';
        };
        closeBtn.onclick = () => {
            gsap.to(panel, {
                opacity: 0,
                scale: 0.95,
                duration: 0.25,
                ease: 'power2.in',
                onComplete: () => panel.remove(),
            });
        };

        panel.appendChild(closeBtn);
        document.body.appendChild(panel);

        gsap.to(panel, {
            opacity: 1,
            scale: 1,
            duration: 0.5,
            ease: 'back.out(1.1)',
        });
    }
}
