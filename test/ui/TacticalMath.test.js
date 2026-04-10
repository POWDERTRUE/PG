// test/ui/TacticalMath.test.js
import { TacticalContextMenuSystem } from '../../frontend/src/engine/ui/TacticalContextMenuSystem.js';

describe('TacticalContextMenuSystem Polar Math', () => {

    it('Debe apuntar al nodo 0 (Norte) en el ángulo exacto', () => {
        // En DOM, Math.atan2 para el Norte puro devuelve -Math.PI / 2
        const index = TacticalContextMenuSystem.polarIndexFromAngle(-Math.PI / 2, 4);
        console.assert(index === 0, \`Fallo: Esperado 0, obtenido \${index}\`);
    });

    it('Debe apuntar al nodo 1 (Este) a 0 radianes', () => {
        // En DOM, Math.atan2 para la Derecha (Este) devuelve 0
        const index = TacticalContextMenuSystem.polarIndexFromAngle(0, 4);
        console.assert(index === 1, \`Fallo: Esperado 1, obtenido \${index}\`);
    });

    it('Debe apuntar al nodo 2 (Sur) a PI/2 radianes', () => {
        // En DOM, Math.atan2 para Abajo (Sur) devuelve Math.PI / 2
        const index = TacticalContextMenuSystem.polarIndexFromAngle(Math.PI / 2, 4);
        console.assert(index === 2, \`Fallo: Esperado 2, obtenido \${index}\`);
    });

    it('Debe apuntar al nodo 3 (Oeste) a PI o -PI radianes', () => {
        // Izquierda puede ser PI o -PI dependiendo de Math.atan2
        const indexPi = TacticalContextMenuSystem.polarIndexFromAngle(Math.PI, 4);
        console.assert(indexPi === 3, \`Fallo: Esperado 3, obtenido \${indexPi}\`);

        const indexMinusPi = TacticalContextMenuSystem.polarIndexFromAngle(-Math.PI, 4);
        console.assert(indexMinusPi === 3, \`Fallo: Esperado 3, obtenido \${indexMinusPi}\`);
    });

    it('Debe recuperar nodo estandar para 8 sectores', () => {
        const indexWarp = TacticalContextMenuSystem.polarIndexFromAngle(-Math.PI / 2, 8);
        console.assert(indexWarp === 0, \`Fallo: Esperado 0, obtenido \${indexWarp}\`);

        const indexComms = TacticalContextMenuSystem.polarIndexFromAngle(0, 8);
        console.assert(indexComms === 2, \`Fallo: Esperado 2, obtenido \${indexComms}\`);
    });
});
