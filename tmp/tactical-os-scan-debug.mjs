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
  responseOpenFlag: window.engine?.luluResponse?._isOpen ?? null,
  wrapHasClass: document.getElementById('lulu-response-wrap')?.classList.contains('is-open') ?? false,
  wrapClasses: document.getElementById('lulu-response-wrap')?.className ?? '',
  wrapText: document.getElementById('lulu-response-wrap')?.innerText ?? '',
  latestPanelHtml: document.getElementById('lulu-response-panel')?.innerHTML ?? '',
}));
console.log(JSON.stringify(result, null, 2));
await browser.close();
