import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:5555/', { waitUntil: 'domcontentloaded' });
await page.click('.menu-item-publico');
await page.waitForFunction(() => typeof window.render_game_to_text === 'function' && JSON.parse(window.render_game_to_text()).status === 'READY');
await page.waitForTimeout(1200);
await page.keyboard.press('Tab');
await page.waitForTimeout(400);
await page.evaluate(() => {
  window.engine.payloadManager.setActivePayload('IMAGE', {
    url: '/assets/images/payload-thermal-vein.svg',
    thumbnailUrl: '/assets/images/payload-thermal-vein.svg',
    label: 'Thermal Vein',
    source: 'debug',
  });
});
await page.waitForTimeout(200);
await page.mouse.click(896, 216, { button: 'right' });
await page.waitForTimeout(300);
const result = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
console.log(JSON.stringify({ menu: result.tacticalContextMenu, payload: result.activePayload, target: result.activeTarget }, null, 2));
await browser.close();
