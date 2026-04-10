// frontend/src/main.js
import { UniverseKernel }    from './engine/UniverseKernel.js';
import { ScreensaverSystem } from './ui/ScreensaverSystem.js';

function installTestingHooks() {
    window.render_game_to_text = () => {
        const kernel = window.engine;
        if (!kernel) {
            return JSON.stringify({ status: 'BOOTING' });
        }

        const camera = kernel.camera;
        const cameraPose = camera?.position ?? kernel.cameraRig?.position ?? null;
        const navigation = kernel.navigationSystem;
        const input = kernel.inputStateSystem;
        const galaxyPoints = kernel.galaxyGenSystem?.points?.geometry?.getAttribute?.('position');
        const galaxyField = kernel.galaxyGenSystem?.points ?? null;
        const activeTarget = kernel.interactionSystem?.getActiveTarget?.();
        const sceneOffset = galaxyField?.position ?? null;
        const particleProjector = kernel.projectParticlesSystem?.getDebugState?.() ?? null;
        const stellarLod = kernel.stellarLODSystem?.getDebugState?.() ?? null;
        const ontologyMap = kernel.luluMindMapWindow?.getDebugState?.() ?? null;
        const activePayload = kernel.payloadManager?.getDebugState?.() ?? null;
        const payloadIndicator = kernel.payloadIndicatorSystem?.getDebugState?.() ?? null;
        const tacticalReadout = kernel.tacticalReadoutSystem?.getDebugState?.() ?? null;
        const tacticalContextMenu = kernel.tacticalContextMenuSystem?.getDebugState?.() ?? null;
        const targetTracker = kernel.targetTrackingSystem?.getDebugState?.() ?? null;
        const warpCinematic = kernel.warpCinematicSystem?.getDebugState?.() ?? null;
        const persistence = kernel.persistenceSystem?.getDebugState?.() ?? null;
        const inputArbitration = input?.getDebugState?.() ?? null;

        return JSON.stringify({
            status: kernel.state,
            navigationState: navigation?.state ?? 'OFFLINE',
            paused: kernel.runtimeState?.isGamePaused?.() ?? !!window.__gamePaused,
            hudMode: input?.hudMode ?? false,
            inputContext: input?.getInputContext?.() ?? input?.currentContext ?? null,
            pointerLocked: input?.pointer?.locked ?? false,
            autoBrakeActive: navigation?.isAutoBrakeActive?.() ?? navigation?.autoBrakeActive ?? false,
            alignBowActive: navigation?.isBowAlignmentActive?.() ?? navigation?.alignBowActive ?? false,
            camera: cameraPose ? {
                x: Number(cameraPose.x.toFixed(2)),
                y: Number(cameraPose.y.toFixed(2)),
                z: Number(cameraPose.z.toFixed(2)),
            } : null,
            focusTarget: navigation?.focusTarget?.name ?? null,
            activeTarget: activeTarget?.name ?? null,
            particleProjector,
            stellarLod,
            ontologyMap,
            activePayload,
            payloadIndicator,
            tacticalReadout,
            tacticalContextMenu,
            targetTracker,
            warpCinematic,
            inputArbitration,
            persistence,
            render: {
                fpsTarget: kernel.renderPipeline?.targetFPS ?? null,
                drawCalls: kernel.renderer?.info?.render?.calls ?? 0,
            },
            galaxy: {
                mainStars: galaxyPoints?.count ?? 0,
                streamedSectors: kernel.sectorStreamingSystem?.loadedSectorCount ?? 0,
                sceneOffset: sceneOffset ? {
                    x: Number(sceneOffset.x.toFixed(2)),
                    y: Number(sceneOffset.y.toFixed(2)),
                    z: Number(sceneOffset.z.toFixed(2)),
                } : null,
            },
        });
    };

    window.advanceTime = async (ms = 16.67) => {
        const frameBudget = Math.max(1, Math.round(ms / (1000 / 60)));
        for (let i = 0; i < frameBudget; i++) {
            await new Promise((resolve) => requestAnimationFrame(resolve));
        }
    };
}

window.addEventListener('DOMContentLoaded', async () => {
    console.log('%c[PowderGalaxy] Starting OMEGA V31 Bootstrap...', 'color:#00ffcc;font-weight:bold');
    
    try {
        const kernel = new UniverseKernel();
        await kernel.boot();
        console.log('%c[PowderGalaxy] Engine Online.', 'color:#00ffcc;font-weight:bold');
        installTestingHooks();

        // Idle screensaver — fades to black after inactivity, wakes on mouse move
        new ScreensaverSystem().start();
    } catch (err) {
        console.error('[PowderGalaxy] Critical Boot Failure:', err);
    }
});
