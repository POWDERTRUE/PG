const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle','--use-angle=swiftshader'] });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5555', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.click('.menu-item-publico');
  await page.waitForTimeout(2000);
  const payload = await page.evaluate(() => {
    const engine = window.engine;
    const camera = engine?.camera;
    const rig = engine?.cameraRig;
    const nav = engine?.navigationSystem;
    const field = window.scene?.getObjectByName?.('GalaxyField_Main');
    const blackHole = window.scene?.getObjectByName?.('GalacticCore_BlackHole');
    const hdri = window.scene?.getObjectByName?.('DeepSpaceHDRI');
    const vecCtor = camera?.position?.constructor || rig?.position?.constructor;
    const worldPos = (obj) => {
      if (!obj || !vecCtor) return null;
      const v = new vecCtor();
      obj.getWorldPosition(v);
      return { x: v.x, y: v.y, z: v.z };
    };
    const camDir = (() => {
      if (!camera || !vecCtor) return null;
      const v = new vecCtor(0, 0, -1);
      v.applyQuaternion(camera.quaternion);
      return { x: v.x, y: v.y, z: v.z };
    })();
    if (field?.geometry && !field.geometry.boundingSphere) {
      field.geometry.computeBoundingSphere();
    }
    return {
      state: engine?.state,
      navState: nav?.state,
      fsm: nav?.fsm?.currentState ? nav.fsm.currentState.constructor.name : null,
      camPos: camera ? { x: camera.position.x, y: camera.position.y, z: camera.position.z } : null,
      camQuat: camera ? { x: camera.quaternion.x, y: camera.quaternion.y, z: camera.quaternion.z, w: camera.quaternion.w } : null,
      camDir,
      rigPos: rig ? { x: rig.position.x, y: rig.position.y, z: rig.position.z } : null,
      rigQuat: rig ? { x: rig.quaternion.x, y: rig.quaternion.y, z: rig.quaternion.z, w: rig.quaternion.w } : null,
      field: field ? {
        visible: field.visible,
        position: { x: field.position.x, y: field.position.y, z: field.position.z },
        rotation: { x: field.rotation.x, y: field.rotation.y, z: field.rotation.z },
        count: field.geometry?.attributes?.position?.count,
        material: {
          size: field.material?.size,
          opacity: field.material?.opacity,
          blending: field.material?.blending,
          depthWrite: field.material?.depthWrite,
          transparent: field.material?.transparent,
        },
        boundingSphere: field.geometry?.boundingSphere ? {
          radius: field.geometry.boundingSphere.radius,
          center: {
            x: field.geometry.boundingSphere.center.x,
            y: field.geometry.boundingSphere.center.y,
            z: field.geometry.boundingSphere.center.z,
          }
        } : null,
        worldPos: worldPos(field),
      } : null,
      blackHole: blackHole ? { pos: worldPos(blackHole) } : null,
      hdri: hdri ? { pos: worldPos(hdri), visible: hdri.visible } : null,
      children: window.scene?.children?.slice?.(0,12)?.map?.(o => ({ name: o.name, type: o.type, visible: o.visible, pos: { x: o.position.x, y: o.position.y, z: o.position.z } })) ?? [],
      renderer: engine?.renderer?.info?.render ? { calls: engine.renderer.info.render.calls, triangles: engine.renderer.info.render.triangles, points: engine.renderer.info.render.points } : null,
    };
  });
  console.log(JSON.stringify(payload, null, 2));
  await browser.close();
})();
