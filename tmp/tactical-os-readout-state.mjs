import fs from 'node:fs';
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:5555/', { waitUntil: 'domcontentloaded' });
await page.click('.menu-item-publico');
await page.waitForFunction(() => typeof window.render_game_to_text === 'function' && JSON.parse(window.render_game_to_text()).status === 'READY');
await page.waitForTimeout(1200);
await page.keyboard.press('Tab');
await page.waitForTimeout(400);
const target = await page.evaluate(() => {
  const ray = window.engine?.raycastSelectionSystem;
  const hits = [];
  for (let yi = -0.9; yi <= 0.9; yi += 0.05) {
    for (let xi = -0.9; xi <= 0.9; xi += 0.05) {
      const hit = ray._performRaycastForNDC({ x: xi, y: yi });
      if (!hit?.object) continue;
      const userData = hit.object.userData || {};
      hits.push({
        uuid: hit.object.uuid,
        deterministicKey: userData.deterministicKey || null,
        screenX: Math.round(((xi + 1) * 0.5) * window.innerWidth),
        screenY: Math.round(((-yi + 1) * 0.5) * window.innerHeight),
      });
    }
  }
  return hits.find((hit) => hit.deterministicKey === 'observer-system/planet/hologram') || hits[0] || null;
});
await page.mouse.click(target.screenX, target.screenY, { button: 'left' });
await page.waitForTimeout(250);
const state = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
fs.writeFileSync('output/tactical-os-check/readout-state.json', JSON.stringify({ target, readout: state.tacticalReadout, activeTarget: state.activeTarget }, null, 2));
await browser.close();
