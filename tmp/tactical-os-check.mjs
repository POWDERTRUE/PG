import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('output/tactical-os-check');
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
const pickTargetPoint = async (preferredTargetId = null, preferredKey = null) => page.evaluate(({ preferredTargetId, preferredKey }) => {
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
    const aPinned = preferredTargetId && a.uuid === preferredTargetId ? 0 : preferredKey && a.deterministicKey === preferredKey ? 0 : 1;
    const bPinned = preferredTargetId && b.uuid === preferredTargetId ? 0 : preferredKey && b.deterministicKey === preferredKey ? 0 : 1;
    if (aPinned !== bPinned) return aPinned - bPinned;
    const aPriority = a.deterministicKey ? 0 : (/planet|mega|sun|sol/i.test(a.name) ? 1 : 2);
    const bPriority = b.deterministicKey ? 0 : (/planet|mega|sun|sol/i.test(b.name) ? 1 : 2);
    if (aPriority !== bPriority) return aPriority - bPriority;
    return Math.hypot(a.ndcX, a.ndcY) - Math.hypot(b.ndcX, b.ndcY);
  });
  return { target: hits[0] || null, candidates: hits.slice(0, 12) };
}, { preferredTargetId, preferredKey });

try {
  await page.goto('http://127.0.0.1:5555/', { waitUntil: 'domcontentloaded' });
  await page.click('.menu-item-publico');
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function' && JSON.parse(window.render_game_to_text()).status === 'READY');
  await page.waitForTimeout(1200);

  const immersiveStart = await readState();

  await page.keyboard.press('Tab');
  await page.waitForTimeout(500);
  const tacticalStart = await readState();

  const initialTargetInfo = await pickTargetPoint();
  if (!initialTargetInfo?.target) throw new Error('No hittable tactical mass target was found on screen.');

  await page.mouse.click(initialTargetInfo.target.screenX, initialTargetInfo.target.screenY, { button: 'left' });
  await page.waitForTimeout(250);
  const readoutState = await readState();
  const lockedTargetId = readoutState.tacticalReadout?.targetId ?? initialTargetInfo.target.uuid;
  const lockedKey = readoutState.tacticalReadout?.deterministicKey ?? initialTargetInfo.target.deterministicKey ?? null;

  await page.evaluate(() => {
    window.engine?.payloadManager?.setActivePayload?.('IMAGE', {
      url: '/assets/images/payload-thermal-vein.svg',
      thumbnailUrl: '/assets/images/payload-thermal-vein.svg',
      label: 'Thermal Vein',
      source: 'tactical-os-check',
    });
  });
  await page.waitForTimeout(200);
  const payloadState = await readState();

  const injectTargetInfo = await pickTargetPoint(lockedTargetId, lockedKey);
  await page.mouse.click(injectTargetInfo.target.screenX, injectTargetInfo.target.screenY, { button: 'right' });
  await page.waitForTimeout(250);
  const contextMenuOpen = await readState();
  await page.screenshot({ path: path.join(outputDir, 'context-menu.png') });
  if (contextMenuOpen.tacticalContextMenu?.open) {
    await page.click('#omega-context-menu [data-action="inject"]');
  }
  await page.waitForTimeout(300);
  const afterInject = await readState();

  const scanTargetInfo = await pickTargetPoint(lockedTargetId, lockedKey);
  await page.mouse.click(scanTargetInfo.target.screenX, scanTargetInfo.target.screenY, { button: 'right' });
  await page.waitForTimeout(250);
  const menuBeforeScan = await readState();
  if (menuBeforeScan.tacticalContextMenu?.open) {
    await page.evaluate(() => document.querySelector('#omega-context-menu [data-action="scan"]')?.click());
  }
  await page.waitForTimeout(450);
  const scanState = await page.evaluate(() => ({
    wrapOpen: document.getElementById('lulu-response-wrap')?.classList.contains('is-open') ?? false,
    wrapText: document.getElementById('lulu-response-wrap')?.innerText || '',
  }));

  const warpTargetInfo = await pickTargetPoint(lockedTargetId, lockedKey);
  await page.mouse.click(warpTargetInfo.target.screenX, warpTargetInfo.target.screenY, { button: 'right' });
  await page.waitForTimeout(250);
  const menuBeforeWarp = await readState();
  if (menuBeforeWarp.tacticalContextMenu?.open) {
    await page.evaluate(() => document.querySelector('#omega-context-menu [data-action="warp"]')?.click());
  }
  await page.waitForTimeout(900);
  const afterWarp = await readState();
  await page.screenshot({ path: path.join(outputDir, 'after-warp.png') });

  const result = {
    targetInfo: initialTargetInfo,
    immersiveStart: {
      navigationState: immersiveStart.navigationState,
      inputContext: immersiveStart.inputContext,
      pointerLocked: immersiveStart.pointerLocked,
    },
    tacticalStart: {
      navigationState: tacticalStart.navigationState,
      inputContext: tacticalStart.inputContext,
      pointerLocked: tacticalStart.pointerLocked,
      autoBrakeActive: tacticalStart.autoBrakeActive,
    },
    readoutState: readoutState.tacticalReadout,
    payloadState: payloadState.activePayload,
    contextMenuOpen: contextMenuOpen.tacticalContextMenu,
    afterInject: {
      projector: afterInject.particleProjector,
      activePayload: afterInject.activePayload,
      tacticalContextMenu: afterInject.tacticalContextMenu,
    },
    scanState,
    afterWarp: {
      navigationState: afterWarp.navigationState,
      focusTarget: afterWarp.focusTarget,
      autoBrakeActive: afterWarp.autoBrakeActive,
      tacticalReadout: afterWarp.tacticalReadout,
    },
    consoleErrors,
    pageErrors,
  };

  fs.writeFileSync(path.join(outputDir, 'result.json'), JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
