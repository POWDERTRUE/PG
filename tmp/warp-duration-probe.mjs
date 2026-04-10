import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

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
        screenX: Math.round(((xi + 1) * 0.5) * window.innerWidth),
        screenY: Math.round(((-yi + 1) * 0.5) * window.innerHeight),
        deterministicKey: userData.deterministicKey || null,
      });
    }
  }
  hits.sort((a, b) => (a.deterministicKey ? 0 : 1) - (b.deterministicKey ? 0 : 1));
  return hits[0] || null;
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

  const target = await pickTargetPoint();
  await page.mouse.click(target.screenX, target.screenY, { button: 'left' });
  await page.waitForTimeout(220);
  const lockState = await readState();
  await page.mouse.click(lockState.targetTracker.screenX, lockState.targetTracker.screenY, { button: 'right' });
  await page.waitForTimeout(220);
  await page.click('#omega-context-menu [data-action="warp"]');

  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(1000);
    const state = await readState();
    console.log(JSON.stringify({
      second: i + 1,
      navigationState: state.navigationState,
      focusTarget: state.focusTarget,
      warpCinematic: state.warpCinematic,
    }));
  }
} finally {
  await browser.close();
}
