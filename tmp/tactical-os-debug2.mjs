import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:5555/', { waitUntil: 'domcontentloaded' });
await page.click('.menu-item-publico');
await page.waitForFunction(() => typeof window.render_game_to_text === 'function' && JSON.parse(window.render_game_to_text()).status === 'READY');
await page.waitForTimeout(1200);
await page.keyboard.press('Tab');
await page.waitForTimeout(400);
const setup = await page.evaluate(() => {
  const engine = window.engine;
  const obj = engine.scene.getObjectByName('MegaSun');
  const pos = obj.getWorldPosition(obj.position.clone()).project(engine.camera);
  return {
    screenX: ((pos.x + 1) * 0.5) * window.innerWidth,
    screenY: ((-pos.y + 1) * 0.5) * window.innerHeight,
    ndc: { x: pos.x, y: pos.y },
    rect: engine.renderer.domElement.getBoundingClientRect().toJSON(),
  };
});
await page.mouse.click(setup.screenX, setup.screenY, { button: 'left' });
await page.waitForTimeout(200);
const result = await page.evaluate((expected) => {
  const input = window.engine.inputStateSystem;
  const ray = window.engine.raycastSelectionSystem;
  const state = JSON.parse(window.render_game_to_text());
  return {
    expected,
    sharedCursorNDC: input.getSharedCursorNDC(),
    directHitFromShared: ray._performRaycastForNDC({ x: input.getSharedCursorNDC().x, y: input.getSharedCursorNDC().y })?.object?.name || null,
    readout: state.tacticalReadout,
    elementAtPoint: document.elementFromPoint(expected.screenX, expected.screenY)?.id || document.elementFromPoint(expected.screenX, expected.screenY)?.tagName || null,
  };
}, setup);
console.log(JSON.stringify(result, null, 2));
await browser.close();
