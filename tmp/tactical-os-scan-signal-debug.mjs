import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:5555/', { waitUntil: 'domcontentloaded' });
await page.click('.menu-item-publico');
await page.waitForFunction(() => typeof window.render_game_to_text === 'function' && JSON.parse(window.render_game_to_text()).status === 'READY');
await page.waitForTimeout(1200);
await page.keyboard.press('Tab');
await page.waitForTimeout(400);
await page.mouse.click(896, 234, { button: 'left' });
await page.waitForTimeout(250);
await page.mouse.click(896, 234, { button: 'right' });
await page.waitForTimeout(250);
const result = await page.evaluate(() => {
  window.__scanSignals = [];
  const rs = window.engine.runtimeSignals;
  rs.on('PG:OS:TACTICAL_SCAN_REQUESTED', (p) => window.__scanSignals.push({ source: p?.source || null, targetId: p?.targetId || null }));
  const button = document.querySelector('#omega-context-menu [data-action="scan"]');
  button?.click();
  return {
    buttonExists: !!button,
    buttonDisabled: !!button?.disabled,
    menuBefore: document.getElementById('omega-context-menu')?.className ?? '',
  };
});
await page.waitForTimeout(200);
const final = await page.evaluate(() => ({
  signals: window.__scanSignals,
  menuClass: document.getElementById('omega-context-menu')?.className ?? '',
  readout: JSON.parse(window.render_game_to_text()).tacticalReadout,
}));
console.log(JSON.stringify({ result, final }, null, 2));
await browser.close();
