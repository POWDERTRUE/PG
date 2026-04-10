import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:5555/', { waitUntil: 'domcontentloaded' });
await page.click('.menu-item-publico');
await page.waitForFunction(() => typeof window.render_game_to_text === 'function' && JSON.parse(window.render_game_to_text()).status === 'READY');
await page.waitForTimeout(1200);
await page.keyboard.press('Tab');
await page.waitForTimeout(400);
const hitPoint = await page.evaluate(() => {
  const ray = window.engine.raycastSelectionSystem;
  const found = [];
  for (let yi = -0.9; yi <= 0.9; yi += 0.05) {
    for (let xi = -0.9; xi <= 0.9; xi += 0.05) {
      const hit = ray._performRaycastForNDC({ x: xi, y: yi });
      if (!hit?.object) continue;
      const userData = hit.object.userData || {};
      found.push({
        name: hit.object.name || userData.label || 'unnamed',
        uuid: hit.object.uuid,
        deterministicKey: userData.deterministicKey || null,
        x: xi,
        y: yi,
      });
    }
  }
  found.sort((a, b) => {
    const aPriority = a.deterministicKey ? 0 : (/mega|sun|sol|planet/i.test(a.name) ? 1 : 2);
    const bPriority = b.deterministicKey ? 0 : (/mega|sun|sol|planet/i.test(b.name) ? 1 : 2);
    if (aPriority !== bPriority) return aPriority - bPriority;
    return Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y);
  });
  const best = found[0] || null;
  if (!best) return { best: null, count: 0 };
  return {
    best: {
      ...best,
      screenX: ((best.x + 1) * 0.5) * window.innerWidth,
      screenY: ((-best.y + 1) * 0.5) * window.innerHeight,
    },
    count: found.length,
    sample: found.slice(0, 12),
  };
});
console.log(JSON.stringify(hitPoint, null, 2));
await browser.close();
