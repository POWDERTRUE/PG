import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('output/target-tracker-check');
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
    label: node.querySelector('.target-tracker-label')?.textContent || '',
    status: node.querySelector('.target-tracker-status')?.textContent || '',
  };
});

try {
  await page.goto('http://127.0.0.1:5555/', { waitUntil: 'domcontentloaded' });
  await page.click('.menu-item-publico');
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function' && JSON.parse(window.render_game_to_text()).status === 'READY');
  await page.waitForTimeout(1200);

  await page.keyboard.down('KeyW');
  await page.waitForTimeout(450);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(120);

  const immersiveBeforeTab = await readState();
  await page.keyboard.press('Tab');
  await page.waitForTimeout(280);

  const tacticalStart = await readState();
  const targetInfo = await pickTargetPoint();
  if (!targetInfo?.target) {
    throw new Error('No hittable target found for target tracker verification.');
  }

  await page.mouse.click(targetInfo.target.screenX, targetInfo.target.screenY, { button: 'left' });
  await page.waitForTimeout(220);

  const afterLock = await readState();
  const trackerAfterLock = afterLock.targetTracker;
  if (!trackerAfterLock?.active || !trackerAfterLock?.visible) {
    throw new Error('Target tracker did not activate after tactical lock-on.');
  }

  await page.screenshot({ path: path.join(outputDir, 'tracker-locked.png') });
  const trackerDomAfterLock = await readTrackerDom();

  await page.waitForTimeout(900);
  const duringBrake = await readState();
  const trackerDuringBrake = duringBrake.targetTracker;
  if (!trackerDuringBrake?.active || !trackerDuringBrake?.visible) {
    throw new Error('Target tracker did not remain active during auto-brake drift.');
  }

  await page.screenshot({ path: path.join(outputDir, 'tracker-drift.png') });
  const trackerDomDuringBrake = await readTrackerDom();

  const trackerDelta = {
    dx: trackerDuringBrake.screenX - trackerAfterLock.screenX,
    dy: trackerDuringBrake.screenY - trackerAfterLock.screenY,
    distance: Number(
      Math.hypot(
        trackerDuringBrake.screenX - trackerAfterLock.screenX,
        trackerDuringBrake.screenY - trackerAfterLock.screenY
      ).toFixed(2)
    ),
  };

  await page.mouse.click(trackerDuringBrake.screenX, trackerDuringBrake.screenY, { button: 'right' });
  await page.waitForTimeout(250);
  const afterMenuOpen = await readState();
  const trackerAfterMenu = afterMenuOpen.targetTracker;
  const menuState = afterMenuOpen.tacticalContextMenu;
  await page.screenshot({ path: path.join(outputDir, 'tracker-context-menu.png') });

  const result = {
    targetInfo,
    immersiveBeforeTab: {
      navigationState: immersiveBeforeTab.navigationState,
      inputContext: immersiveBeforeTab.inputContext,
      pointerLocked: immersiveBeforeTab.pointerLocked,
      camera: immersiveBeforeTab.camera,
    },
    tacticalStart: {
      navigationState: tacticalStart.navigationState,
      inputContext: tacticalStart.inputContext,
      pointerLocked: tacticalStart.pointerLocked,
      autoBrakeActive: tacticalStart.autoBrakeActive,
    },
    trackerAfterLock,
    trackerDomAfterLock,
    trackerDuringBrake,
    trackerDomDuringBrake,
    trackerDelta,
    menuState,
    trackerAfterMenu,
    consoleErrors,
    pageErrors,
  };

  fs.writeFileSync(path.join(outputDir, 'result.json'), JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
