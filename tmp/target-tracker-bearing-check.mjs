import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('output/target-tracker-bearing-check');
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const consoleErrors = [];
const pageErrors = [];

page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (error) => {
  pageErrors.push(String(error?.message || error));
});

const readState = async () => JSON.parse(await page.evaluate(() => window.render_game_to_text()));

const pickTargetPoint = async () => page.evaluate(() => {
  const ray = window.engine?.raycastSelectionSystem;
  if (!ray) return null;

  const hits = [];
  for (let yi = -0.9; yi <= 0.9; yi += 0.05) {
    for (let xi = -0.9; xi <= 0.9; xi += 0.05) {
      const hit = ray._performRaycastForNDC({ x: xi, y: yi });
      if (!hit?.object) continue;
      const userData = hit.object.userData || {};
      hits.push({
        name: hit.object.name || userData.label || 'unnamed',
        uuid: hit.object.uuid,
        deterministicKey: userData.deterministicKey || null,
        screenX: Math.round(((xi + 1) * 0.5) * window.innerWidth),
        screenY: Math.round(((-yi + 1) * 0.5) * window.innerHeight),
        ndcX: xi,
        ndcY: yi,
      });
    }
  }

  hits.sort((a, b) => {
    const aPriority = a.deterministicKey ? 0 : (/planet|mega|sun|sol/i.test(a.name) ? 1 : 2);
    const bPriority = b.deterministicKey ? 0 : (/planet|mega|sun|sol/i.test(b.name) ? 1 : 2);
    if (aPriority !== bPriority) return aPriority - bPriority;
    return Math.hypot(a.ndcX, a.ndcY) - Math.hypot(b.ndcX, b.ndcY);
  });

  return { target: hits[0] || null, candidates: hits.slice(0, 12) };
});

const readTrackerDom = async () => page.evaluate(() => {
  const node = document.getElementById('omega-target-tracker');
  if (!node) return null;
  return {
    className: node.className,
    opacity: getComputedStyle(node).opacity,
    transform: node.style.transform || '',
    bearingAngle: node.style.getPropertyValue('--target-bearing-angle') || '',
    label: node.querySelector('.target-tracker-label')?.textContent || '',
    status: node.querySelector('.target-tracker-status')?.textContent || '',
  };
});

const rotateRigUntil = async (mode) => page.evaluate((mode) => {
  const kernel = window.engine;
  const tracker = kernel?.targetTrackingSystem;
  const rig = kernel?.cameraRig;
  const camera = kernel?.camera;
  if (!tracker || !rig || !camera) return null;

  const syncCamera = () => {
    camera.position.copy(rig.position);
    camera.quaternion.copy(rig.quaternion);
    camera.updateMatrixWorld(true);
  };

  const maxSteps = mode === 'rear' ? 48 : 24;
  const step = mode === 'rear' ? 0.16 : 0.08;

  for (let i = 0; i < maxSteps; i++) {
    rig.rotateY(step);
    rig.updateMatrixWorld(true);
    syncCamera();
    tracker.update(0);
    const state = tracker.getDebugState();
    if (mode === 'offscreen') {
      if (state.active && state.visible && state.offscreen && !state.behindCamera) {
        return { steps: i + 1, state };
      }
    } else if (mode === 'rear') {
      if (state.active && state.visible && state.offscreen && state.behindCamera) {
        return { steps: i + 1, state };
      }
    }
  }

  return { steps: maxSteps, state: tracker.getDebugState() };
}, mode);

try {
  await page.goto('http://127.0.0.1:5555/', { waitUntil: 'domcontentloaded' });
  await page.click('.menu-item-publico');
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function' && JSON.parse(window.render_game_to_text()).status === 'READY');
  await page.waitForTimeout(1200);

  await page.keyboard.down('KeyW');
  await page.waitForTimeout(450);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(120);

  await page.keyboard.press('Tab');
  await page.waitForTimeout(280);

  const targetInfo = await pickTargetPoint();
  if (!targetInfo?.target) {
    throw new Error('No hittable target found for bearing verification.');
  }

  await page.mouse.click(targetInfo.target.screenX, targetInfo.target.screenY, { button: 'left' });
  await page.waitForTimeout(200);

  const lockedState = await readState();
  const trackerLocked = lockedState.targetTracker;
  const trackerDomLocked = await readTrackerDom();
  await page.screenshot({ path: path.join(outputDir, 'tracker-onscreen.png') });

  await page.evaluate(() => {
    if (window.engine) {
      window.engine.isPaused = true;
    }
  });

  const offscreenRotation = await rotateRigUntil('offscreen');
  const offscreenState = await readState();
  const trackerDomOffscreen = await readTrackerDom();
  await page.screenshot({ path: path.join(outputDir, 'tracker-offscreen.png') });

  const rearRotation = await rotateRigUntil('rear');
  const rearState = await readState();
  const trackerDomRear = await readTrackerDom();
  await page.screenshot({ path: path.join(outputDir, 'tracker-rear.png') });

  const result = {
    targetInfo,
    trackerLocked,
    trackerDomLocked,
    offscreenRotation,
    offscreenTracker: offscreenState.targetTracker,
    trackerDomOffscreen,
    rearRotation,
    rearTracker: rearState.targetTracker,
    trackerDomRear,
    consoleErrors,
    pageErrors,
  };

  fs.writeFileSync(path.join(outputDir, 'result.json'), JSON.stringify(result, null, 2));
} finally {
  try {
    await page.evaluate(() => {
      if (window.engine) {
        window.engine.isPaused = false;
      }
    });
  } catch {}
  await browser.close();
}
