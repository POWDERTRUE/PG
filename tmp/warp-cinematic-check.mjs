import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('output/warp-cinematic-check');
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
    status: node.querySelector('.target-tracker-status')?.textContent || '',
  };
});

try {
  await page.goto('http://127.0.0.1:5555/', { waitUntil: 'domcontentloaded' });
  await page.click('.menu-item-publico');
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function' && JSON.parse(window.render_game_to_text()).status === 'READY');
  await page.waitForTimeout(1200);

  await page.keyboard.down('KeyW');
  await page.waitForTimeout(420);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(120);

  await page.keyboard.press('Tab');
  await page.waitForTimeout(280);
  const targetInfo = await pickTargetPoint();
  if (!targetInfo?.target) {
    throw new Error('No hittable warp target found.');
  }

  await page.mouse.click(targetInfo.target.screenX, targetInfo.target.screenY, { button: 'left' });
  await page.waitForTimeout(220);
  const lockedState = await readState();
  const trackerLocked = await readTrackerDom();
  await page.screenshot({ path: path.join(outputDir, 'warp-locked.png') });

  await page.mouse.click(
    lockedState.targetTracker?.screenX ?? targetInfo.target.screenX,
    lockedState.targetTracker?.screenY ?? targetInfo.target.screenY,
    { button: 'right' }
  );
  await page.waitForTimeout(220);
  const menuOpen = await readState();
  await page.screenshot({ path: path.join(outputDir, 'warp-menu.png') });

  if (!menuOpen.tacticalContextMenu?.open) {
    throw new Error('Warp menu did not open on tracked target coordinates.');
  }

  await page.click('#omega-context-menu [data-action="warp"]');

  await page.waitForTimeout(180);
  const spoolState = await readState();
  const trackerSpool = await readTrackerDom();
  await page.screenshot({ path: path.join(outputDir, 'warp-spooling.png') });

  await page.waitForTimeout(820);
  const transitState = await readState();
  const trackerTransit = await readTrackerDom();
  await page.screenshot({ path: path.join(outputDir, 'warp-transit.png') });

  await page.waitForTimeout(1800);
  const dropoutState = await readState();
  const trackerDropout = await readTrackerDom();
  await page.screenshot({ path: path.join(outputDir, 'warp-dropout.png') });

  await page.waitForTimeout(1600);
  const settledState = await readState();
  await page.screenshot({ path: path.join(outputDir, 'warp-settled.png') });

  const result = {
    targetInfo,
    lockedState: {
      navigationState: lockedState.navigationState,
      targetTracker: lockedState.targetTracker,
      trackerDom: trackerLocked,
    },
    menuOpen: menuOpen.tacticalContextMenu,
    spoolState: {
      navigationState: spoolState.navigationState,
      warpCinematic: spoolState.warpCinematic,
      targetTracker: spoolState.targetTracker,
      trackerDom: trackerSpool,
    },
    transitState: {
      navigationState: transitState.navigationState,
      focusTarget: transitState.focusTarget,
      warpCinematic: transitState.warpCinematic,
      targetTracker: transitState.targetTracker,
      trackerDom: trackerTransit,
    },
    dropoutState: {
      navigationState: dropoutState.navigationState,
      focusTarget: dropoutState.focusTarget,
      warpCinematic: dropoutState.warpCinematic,
      targetTracker: dropoutState.targetTracker,
      trackerDom: trackerDropout,
    },
    settledState: {
      navigationState: settledState.navigationState,
      focusTarget: settledState.focusTarget,
      warpCinematic: settledState.warpCinematic,
      targetTracker: settledState.targetTracker,
    },
    consoleErrors,
    pageErrors,
  };

  fs.writeFileSync(path.join(outputDir, 'result.json'), JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
