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
  window.__tacticalSignals = [];
  const rs = window.engine.runtimeSignals;
  rs.on('PG:INPUT:TACTICAL_LEFT_CLICK', (p) => window.__tacticalSignals.push({ signal: 'left', target: p?.target?.id || p?.target?.tagName || null, ndc: p?.ndc || null }));
  rs.on('PG:INPUT:TACTICAL_RIGHT_CLICK', (p) => window.__tacticalSignals.push({ signal: 'right', target: p?.target?.id || p?.target?.tagName || null, ndc: p?.ndc || null }));
});
await page.mouse.click(896, 216, { button: 'left' });
await page.waitForTimeout(200);
const result = await page.evaluate(() => ({
  tacticalSignals: window.__tacticalSignals,
  state: JSON.parse(window.render_game_to_text()),
}));
console.log(JSON.stringify(result, null, 2));
await browser.close();
