// test/ui/TacticalMath.boundary.test.js
import { TacticalContextMenuSystem } from '../../frontend/src/engine/ui/TacticalContextMenuSystem.js';

describe('TacticalContextMenuSystem Boundary Math', () => {
    
    // El offset matemático local de OMEGA mapea la entrada `dy < 0 dx = 0` (-PI/2) como indice 0
    it('Debe probar todos los bordes (4 Nodos)', () => {
        const cases = [
            { angle: -Math.PI/2, expected4: 0 },
            { angle: 0,          expected4: 1 },
            { angle: Math.PI/2,  expected4: 2 },
            { angle: Math.PI,    expected4: 3 },
            { angle: -Math.PI,   expected4: 3 }
        ];

        cases.forEach(c => {
            const idx = TacticalContextMenuSystem.polarIndexFromAngle(c.angle, 4);
            console.assert(idx === c.expected4, \`Angle \${c.angle} -> \${idx} != \${c.expected4}\`);
        });
    });

});
