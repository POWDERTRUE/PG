import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:5555/', { waitUntil: 'domcontentloaded' });
await page.click('.menu-item-publico');
await page.waitForFunction(() => typeof window.render_game_to_text === 'function' && JSON.parse(window.render_game_to_text()).status === 'READY');
await page.waitForTimeout(1200);
await page.keyboard.press('Tab');
await page.waitForTimeout(400);
const result = await page.evaluate(() => {
  const engine = window.engine;
  const camera = engine.camera;
  const ray = engine.raycastSelectionSystem;
  const scene = engine.scene;
  const candidates = [];
  scene.traverse((object) => {
    const u = object.userData || {};
    if (!object.visible || !u.isMass || u.nodeType === 'supraconsciousness' || u.isHitbox || /^Hitbox_/i.test(object.name || '')) return;
    const pos = object.getWorldPosition(object.position.clone());
    const projected = pos.clone().project(camera);
    if (projected.z < -1 || projected.z > 1) return;
    candidates.push({
      name: object.name,
      ndc: { x: projected.x, y: projected.y },
      screen: {
        x: ((projected.x + 1) * 0.5) * window.innerWidth,
        y: ((-projected.y + 1) * 0.5) * window.innerHeight,
      },
      directHit: ray._performRaycastForNDC({ x: projected.x, y: projected.y })?.object?.name || null,
    });
  });
  const mega = candidates.find((c) => c.name === 'MegaSun') || null;
  const element = mega ? document.elementFromPoint(mega.screen.x, mega.screen.y) : null;
  if (mega) {
    engine.runtimeSignals.emit('PG:INPUT:TACTICAL_LEFT_CLICK', { ndc: mega.ndc, target: null });
  }
  const state = JSON.parse(window.render_game_to_text());
  return {
    mega,
    elementTag: element?.tagName || null,
    elementId: element?.id || null,
    elementClass: element?.className || null,
    readout: state.tacticalReadout,
    menu: state.tacticalContextMenu,
  };
});
console.log(JSON.stringify(result, null, 2));
await browser.close();
