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
  window.__pointerEvents = [];
  window.addEventListener('pointerdown', (e) => {
    window.__pointerEvents.push({ type: 'pointerdown', button: e.button, x: e.clientX, y: e.clientY, target: e.target?.id || e.target?.className || e.target?.tagName });
  }, { capture: true });
  window.addEventListener('mousedown', (e) => {
    window.__pointerEvents.push({ type: 'mousedown', button: e.button, x: e.clientX, y: e.clientY, target: e.target?.id || e.target?.className || e.target?.tagName });
  }, { capture: true });
});
await page.mouse.click(896, 216, { button: 'left' });
await page.waitForTimeout(200);
const result = await page.evaluate(() => ({
  events: window.__pointerEvents,
  state: JSON.parse(window.render_game_to_text()),
}));
console.log(JSON.stringify(result, null, 2));
await browser.close();
