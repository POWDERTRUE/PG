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
await page.click('#omega-context-menu [data-action="scan"]');
await page.waitForTimeout(450);
const result = await page.evaluate(() => ({
  wrapOpen: document.getElementById('lulu-response-wrap')?.classList.contains('is-open') ?? false,
  wrapText: document.getElementById('lulu-response-wrap')?.innerText || '',
  state: JSON.parse(window.render_game_to_text()),
}));
console.log(JSON.stringify({ wrapOpen: result.wrapOpen, wrapText: result.wrapText, readout: result.state.tacticalReadout }, null, 2));
await browser.close();
