const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle','--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://127.0.0.1:5555', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.click('.menu-item-publico');
  await page.waitForTimeout(6000);
  const payload = await page.evaluate(() => {
    const engine = window.engine;
    const camera = engine?.camera;
    const rig = engine?.cameraRig;
    const nav = engine?.navigationSystem;
    const field = window.scene?.getObjectByName?.('GalaxyField_Main');
    const vecCtor = camera?.position?.constructor || rig?.position?.constructor;
    const dir = (() => {
      if (!camera || !vecCtor) return null;
      const v = new vecCtor(0,0,-1).applyQuaternion(camera.quaternion);
      return { x: v.x, y: v.y, z: v.z };
    })();
    const toCenter = camera && vecCtor ? new vecCtor().subVectors(field.position, camera.position).normalize() : null;
    const dot = dir && toCenter ? dir.x*toCenter.x + dir.y*toCenter.y + dir.z*toCenter.z : null;
    return {
      navState: nav?.state,
      fsm: nav?.fsm?.currentStateId ?? nav?.fsm?.currentId ?? null,
      camPos: camera ? { x: camera.position.x, y: camera.position.y, z: camera.position.z } : null,
      camDir: dir,
      toCenter,
      lookDot: dot,
      fov: camera?.fov,
      fieldPos: field ? { x: field.position.x, y: field.position.y, z: field.position.z } : null,
      fieldCount: field?.geometry?.attributes?.position?.count ?? null,
      firstStars: field ? Array.from(field.geometry.attributes.position.array.slice(0, 12)) : null,
      renderer: engine?.renderer?.info?.render ? { calls: engine.renderer.info.render.calls, triangles: engine.renderer.info.render.triangles, points: engine.renderer.info.render.points, lines: engine.renderer.info.render.lines } : null,
    };
  });
  console.log(JSON.stringify(payload, null, 2));
  await page.screenshot({ path: 'output/inspect-publico.png' });
  await browser.close();
})();
