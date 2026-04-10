import { chromium } from 'playwright';

const BASE_URL = 'http://127.0.0.1:3000';
const CANVAS_SEL = 'canvas';
const TIMEOUT_MS = 45000;

async function waitForEngineReady(page) {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    await page.waitForSelector(CANVAS_SEL, { timeout: TIMEOUT_MS });
    await page.waitForFunction(() => {
        const reg = window.__PG_REGISTRY || window.Registry;
        if (reg && reg._services instanceof Map) {
            return reg._services.has('InputStateSystem') || reg._services.has('UniverseNavigationSystem');
        }
        return !!window.engine;
    }, { timeout: TIMEOUT_MS });

    await page.evaluate(() => {
        window.__loginActive = false;
        window.__gamePaused = false;
        const reg = window.__PG_REGISTRY || window.Registry;
        if (reg && reg._services instanceof Map) {
            const runtime = reg._services.get('RuntimeState') || reg._services.get('runtimeState');
            runtime?.setLoginActive?.(false);
            runtime?.setGamePaused?.(false);
        }
    });

    await page.waitForTimeout(500);
}

async function sampleState(page) {
    return page.evaluate(() => {
        const engine = window.engine || {};
        const camera = engine.camera || {}; 
        const nav = engine.navigationSystem || engine.universeNavigationSystem || {};
        const planetBuilder = engine.planetBuilderSystem || {};
        const pool = engine.terrainChunkPool || {};
        const shader = engine.planetShaderSystem || {};
        const frameInfo = engine.renderer?.info?.render || {};
        const debug = window.render_game_to_text ? JSON.parse(window.render_game_to_text()) : {};
        return {
            status: engine.state || debug.status || 'UNKNOWN',
            camera: {
                x: Number(camera.position?.x?.toFixed?.(2) ?? null),
                y: Number(camera.position?.y?.toFixed?.(2) ?? null),
                z: Number(camera.position?.z?.toFixed?.(2) ?? null),
            },
            navigationState: nav.state || debug.navigationState || null,
            autoBrakeActive: nav.isAutoBrakeActive?.() ?? nav.autoBrakeActive ?? null,
            focusTarget: nav.focusTarget?.name ?? null,
            renderer: {
                drawCalls: frameInfo.calls ?? 0,
                fpsTarget: engine.renderPipeline?.targetFPS ?? null,
            },
            planetBuilder: {
                planetCount: planetBuilder.planets ? Object.keys(planetBuilder.planets).length : null,
            },
            terrainChunkPool: {
                activeChunks: pool.activeChunks ? pool.activeChunks.size : null,
                freeChunks: pool.freeList ? pool.freeList.length : null,
                segments: pool.segments ?? null,
            },
            shader: {
                hasPlanetShader: !!shader.atmosphereMaterialBase,
            },
            debug,
        };
    });
}

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await waitForEngineReady(page);
        console.log('ENGINE_READY');

        const initial = await sampleState(page);
        console.log('STATE_INITIAL', JSON.stringify(initial, null, 2));

        for (let i = 0; i < 12; i++) {
            await page.evaluate(() => window.advanceTime?.(16.67));
            await page.waitForTimeout(100);
        }

        const mid = await sampleState(page);
        console.log('STATE_AFTER_12_FRAMES', JSON.stringify(mid, null, 2));

        for (let i = 0; i < 48; i++) {
            await page.evaluate(() => window.advanceTime?.(16.67));
        }

        const final = await sampleState(page);
        console.log('STATE_AFTER_1_SECOND', JSON.stringify(final, null, 2));
    } catch (err) {
        console.error('TEST_ERROR', err);
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
})();
