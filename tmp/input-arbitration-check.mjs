import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('output/input-arbitration-check');
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

const installSignalCounters = async () => page.evaluate(() => {
  const signals = window.engine?.inputStateSystem?.runtimeSignals || window.engine?.runtimeSignals || window.Registry?.tryGet?.('RuntimeSignals');
  if (!signals) return false;
  if (signals.__inputArbitrationWrapped) return true;

  window.__inputArbitrationCounters = {
    leftClicks: 0,
    rightClicks: 0,
    dragStarts: 0,
    dragging: 0,
    dragEnds: 0,
    emitted: [],
  };

  const originalEmit = signals.emit.bind(signals);
  signals.emit = (event, payload, ...rest) => {
    const counters = window.__inputArbitrationCounters;
    switch (event) {
      case 'PG:INPUT:TACTICAL_LEFT_CLICK':
        counters.leftClicks += 1;
        counters.emitted.push(event);
        break;
      case 'PG:INPUT:TACTICAL_RIGHT_CLICK':
        counters.rightClicks += 1;
        counters.emitted.push(event);
        break;
      case 'PG:INPUT:TACTICAL_DRAG_START':
        counters.dragStarts += 1;
        counters.emitted.push(event);
        break;
      case 'PG:INPUT:TACTICAL_DRAGGING':
        counters.dragging += 1;
        break;
      case 'PG:INPUT:TACTICAL_DRAG_END':
        counters.dragEnds += 1;
        counters.emitted.push(event);
        break;
      default:
        break;
    }
    return originalEmit(event, payload, ...rest);
  };

  signals.__inputArbitrationWrapped = true;
  return true;
});

const resetCounters = async () => page.evaluate(() => {
  window.__inputArbitrationCounters = {
    leftClicks: 0,
    rightClicks: 0,
    dragStarts: 0,
    dragging: 0,
    dragEnds: 0,
    emitted: [],
  };
});

const readCounters = async () => page.evaluate(() => window.__inputArbitrationCounters);

const findTargetPoint = async () => page.evaluate(() => {
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
    const aPriority = /hologram/i.test(a.name) ? 0 : (a.deterministicKey ? 1 : 2);
    const bPriority = /hologram/i.test(b.name) ? 0 : (b.deterministicKey ? 1 : 2);
    if (aPriority !== bPriority) return aPriority - bPriority;
    return Math.hypot(a.ndcX, a.ndcY) - Math.hypot(b.ndcX, b.ndcY);
  });

  return hits[0] || null;
});

const findBlankPoint = async () => page.evaluate(() => {
  const ray = window.engine?.raycastSelectionSystem;
  const input = window.engine?.inputStateSystem;
  if (!ray) return null;

  for (let yi = 0.75; yi >= -0.75; yi -= 0.05) {
    for (let xi = -0.75; xi <= 0.75; xi += 0.05) {
      const screenX = Math.round(((xi + 1) * 0.5) * window.innerWidth);
      const screenY = Math.round(((-yi + 1) * 0.5) * window.innerHeight);
      const element = document.elementFromPoint(screenX, screenY);
      if (input?._isUiTarget?.(element)) continue;
      const hit = ray._performRaycastForNDC({ x: xi, y: yi });
      if (hit?.object) continue;
      return {
        screenX,
        screenY,
        ndcX: xi,
        ndcY: yi,
      };
    }
  }

  return null;
});

try {
  await page.goto('http://127.0.0.1:5555/', { waitUntil: 'domcontentloaded' });
  await page.click('.menu-item-publico');
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function' && JSON.parse(window.render_game_to_text()).status === 'READY');
  await page.waitForTimeout(1200);
  await installSignalCounters();

  await page.keyboard.press('Tab');
  await page.waitForTimeout(300);

  const initialState = await readState();

  await page.evaluate(() => window.engine?.windowManager?.openApp?.('gallery', { source: 'input-arbitration-test' }));
  const galleryWindow = page.locator('.glass-window.is-gallery-app-window');
  await galleryWindow.waitFor({ state: 'visible' });
  const galleryHeader = page.locator('.glass-window.is-gallery-app-window .glass-header');
  const headerBefore = await galleryHeader.boundingBox();
  await resetCounters();
  await page.mouse.move(headerBefore.x + (headerBefore.width * 0.5), headerBefore.y + 16);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(headerBefore.x + (headerBefore.width * 0.5) + 82, headerBefore.y + 64, { steps: 10 });
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(260);
  const headerAfter = await galleryHeader.boundingBox();
  const scenarioAState = await readState();
  const scenarioACounters = await readCounters();
  await page.screenshot({ path: path.join(outputDir, 'scenario-a-ui-drag.png') });

  await page.evaluate(() => {
    const closeButton = document.querySelector('.glass-window.is-gallery-app-window [data-close]');
    if (closeButton) {
      closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }
  });
  await page.waitForTimeout(220);

  const blankPoint = await findBlankPoint();
  if (!blankPoint) {
    throw new Error('No blank tactical point found for drag scenario.');
  }
  await resetCounters();
  await page.mouse.move(blankPoint.screenX, blankPoint.screenY);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(blankPoint.screenX + 14, blankPoint.screenY + 2, { steps: 6 });
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(220);
  const scenarioBState = await readState();
  const scenarioBCounters = await readCounters();
  await page.screenshot({ path: path.join(outputDir, 'scenario-b-background-drag.png') });

  const targetPoint = await findTargetPoint();
  if (!targetPoint) {
    throw new Error('No tactical target found for precision click scenario.');
  }
  await resetCounters();
  await page.mouse.move(targetPoint.screenX, targetPoint.screenY);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(targetPoint.screenX + 2, targetPoint.screenY + 1, { steps: 2 });
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(260);
  const scenarioCState = await readState();
  const scenarioCCounters = await readCounters();
  await page.screenshot({ path: path.join(outputDir, 'scenario-c-precision-click.png') });

  const result = {
    initialState: {
      inputContext: initialState.inputContext,
      hudMode: initialState.hudMode,
      pointerLocked: initialState.pointerLocked,
    },
    scenarioA: {
      name: 'ui-window-drag',
      windowMovedPx: headerBefore && headerAfter
        ? {
            x: Math.round(headerAfter.x - headerBefore.x),
            y: Math.round(headerAfter.y - headerBefore.y),
          }
        : null,
      counters: scenarioACounters,
      inputArbitration: scenarioAState.inputArbitration,
      tacticalReadout: scenarioAState.tacticalReadout,
      tacticalContextMenu: scenarioAState.tacticalContextMenu,
    },
    scenarioB: {
      name: 'background-drag',
      point: blankPoint,
      counters: scenarioBCounters,
      inputArbitration: scenarioBState.inputArbitration,
      tacticalReadout: scenarioBState.tacticalReadout,
      tacticalContextMenu: scenarioBState.tacticalContextMenu,
    },
    scenarioC: {
      name: 'precision-click',
      point: targetPoint,
      counters: scenarioCCounters,
      inputArbitration: scenarioCState.inputArbitration,
      tacticalReadout: scenarioCState.tacticalReadout,
      tacticalContextMenu: scenarioCState.tacticalContextMenu,
      targetTracker: scenarioCState.targetTracker,
    },
    consoleErrors,
    pageErrors,
  };

  fs.writeFileSync(path.join(outputDir, 'result.json'), JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
