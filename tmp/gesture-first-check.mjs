import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

const OUTPUT_DIR = 'C:/xampp/htdocs/Powder_Galaxy/output/gesture-first-check';
const URL = 'http://127.0.0.1:5555/';

await fs.mkdir(OUTPUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const consoleErrors = [];
const pageErrors = [];

page.on('console', (msg) => {
    if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
    }
});
page.on('pageerror', (error) => {
    pageErrors.push(String(error));
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readState() {
    return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

async function advance(ms = 250) {
    await page.evaluate(async (value) => {
        if (typeof window.advanceTime === 'function') {
            await window.advanceTime(value);
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, value));
    }, ms);
}

async function installSignalProbe() {
    await page.evaluate(() => {
        const signals = window.engine?.runtimeSignals || window.engine?.runtimeSignals;
        if (!signals || signals.__gestureProbeInstalled) {
            return;
        }

        window.__gestureProbe = {
            counts: Object.create(null),
            last: null,
        };

        const originalEmit = signals.emit.bind(signals);
        signals.emit = (eventName, payload) => {
            const counts = window.__gestureProbe.counts;
            counts[eventName] = (counts[eventName] || 0) + 1;
            window.__gestureProbe.last = { eventName, payload };
            return originalEmit(eventName, payload);
        };
        signals.__gestureProbeInstalled = true;
    });
}

async function getProbe() {
    return page.evaluate(() => window.__gestureProbe || { counts: {}, last: null });
}

async function pickVisibleMass() {
    return page.evaluate(() => {
        const engine = window.engine;
        const camera = engine?.camera;
        const scene = engine?.scene;
        if (!camera || !scene) {
            return null;
        }

        const Vector3 = camera.position.constructor;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const candidateNames = ['Planet_Hologram', 'Planet_Explorer', 'MegaSun', 'Terminal'];

        const projectObject = (object) => {
            if (!object) return null;
            const world = new Vector3();
            object.getWorldPosition(world);
            world.project(camera);
            if (!Number.isFinite(world.x) || !Number.isFinite(world.y) || !Number.isFinite(world.z)) {
                return null;
            }
            return {
                object,
                screenX: ((world.x + 1) * 0.5) * viewportWidth,
                screenY: ((-world.y + 1) * 0.5) * viewportHeight,
                ndcX: world.x,
                ndcY: world.y,
                ndcZ: world.z,
            };
        };

        for (const name of candidateNames) {
            const projected = projectObject(scene.getObjectByName(name));
            if (!projected) continue;
            if (projected.ndcZ < -1 || projected.ndcZ > 1) continue;
            if (projected.screenX < 40 || projected.screenX > viewportWidth - 40) continue;
            if (projected.screenY < 40 || projected.screenY > viewportHeight - 40) continue;
            return {
                name,
                screenX: projected.screenX,
                screenY: projected.screenY,
                ndcX: projected.ndcX,
                ndcY: projected.ndcY,
                ndcZ: projected.ndcZ,
            };
        }

        const stack = [...scene.children];
        while (stack.length > 0) {
            const node = stack.shift();
            if (node?.children?.length) {
                stack.push(...node.children);
            }
            if (!node?.userData?.isMass) continue;
            if (String(node.name || '').startsWith('Hitbox_')) continue;
            const projected = projectObject(node);
            if (!projected) continue;
            if (projected.ndcZ < -1 || projected.ndcZ > 1) continue;
            if (projected.screenX < 40 || projected.screenX > viewportWidth - 40) continue;
            if (projected.screenY < 40 || projected.screenY > viewportHeight - 40) continue;
            return {
                name: node.name || node.userData?.label || 'mass',
                screenX: projected.screenX,
                screenY: projected.screenY,
                ndcX: projected.ndcX,
                ndcY: projected.ndcY,
                ndcZ: projected.ndcZ,
            };
        }

        return null;
    });
}

async function centerCameraOnTarget(name) {
    return page.evaluate((targetName) => {
        const engine = window.engine;
        const nav = engine?.navigationSystem;
        const scene = engine?.scene;
        const target = scene?.getObjectByName(targetName);
        if (!nav?.cameraRig || !target) {
            return false;
        }

        const Vector3 = nav.cameraRig.position.constructor;
        const world = new Vector3();
        target.getWorldPosition(world);
        nav.cameraRig.lookAt(world);
        return true;
    }, name);
}

await page.goto(URL, { waitUntil: 'networkidle' });
await page.click('.menu-item-publico');
await advance(1200);
await installSignalProbe();

const initialState = await readState();
const target = await pickVisibleMass();

if (!target) {
    throw new Error('No se encontro una masa visible para la prueba gesture-first.');
}

await page.keyboard.press('Tab');
await advance(400);

await page.mouse.move(target.screenX, target.screenY);
await page.mouse.down({ button: 'left' });
await wait(80);
await page.mouse.up({ button: 'left' });
await advance(400);
const afterOpsTap = await readState();
await page.screenshot({ path: path.join(OUTPUT_DIR, 'ops-tap.png') });

await page.mouse.move(target.screenX, target.screenY);
await page.mouse.down({ button: 'left' });
await wait(620);
await advance(50);
const duringOpsLongPress = await readState();
await page.mouse.up({ button: 'left' });
await advance(320);
const afterOpsLongPress = await readState();
await page.screenshot({ path: path.join(OUTPUT_DIR, 'ops-long-press.png') });

await page.keyboard.press('Tab');
await advance(420);

await page.mouse.move(640, 360);
await page.mouse.down({ button: 'left' });
await wait(620);
await advance(80);
const duringHelmLongPress = await readState();
await page.mouse.up({ button: 'left' });
await advance(240);
const afterHelmLongPress = await readState();
await page.screenshot({ path: path.join(OUTPUT_DIR, 'helm-long-press.png') });

const centered = await centerCameraOnTarget(target.name);
await advance(320);

await page.mouse.move(640, 360);
await page.mouse.down({ button: 'left' });
await wait(40);
await page.mouse.up({ button: 'left' });
await wait(120);
await page.mouse.down({ button: 'left' });
await wait(40);
await page.mouse.up({ button: 'left' });
await advance(520);
const afterHelmDoubleTap = await readState();
await page.screenshot({ path: path.join(OUTPUT_DIR, 'helm-double-tap.png') });

const probe = await getProbe();

const result = {
    initialState,
    target,
    centered,
    afterOpsTap,
    duringOpsLongPress,
    afterOpsLongPress,
    duringHelmLongPress,
    afterHelmLongPress,
    afterHelmDoubleTap,
    probe,
    consoleErrors,
    pageErrors,
};

await fs.writeFile(
    path.join(OUTPUT_DIR, 'result.json'),
    JSON.stringify(result, null, 2),
    'utf8'
);

await browser.close();
