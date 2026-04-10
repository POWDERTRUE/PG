const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle','--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(String(err)));
  await page.goto('http://127.0.0.1:5555', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.click('.menu-item-publico');
  await page.waitForTimeout(3500);
  await page.fill('#lulu-input', 'docs galaxia');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const payload = await page.evaluate(() => Array.from(document.querySelectorAll('#lulu-response-panel div')).map((el) => el.textContent.trim()).filter(Boolean));
  console.log(JSON.stringify({ payload, errors }, null, 2));
  await browser.close();
})();
