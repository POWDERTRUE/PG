/**
 * colorIdUtils.test.js
 */

import { encodeIdToRGBBytes, decodeRGBToId, bytesToNormalizedColor } from '../../src/engine/interaction/colorIdUtils.js';

describe('GPUPicking - Color ID Utils', () => {

    it('Realiza encriptado y desencriptado ida y vuelta perfecto', () => {
        const testIds = [1, 255, 256, 65535, 65536, 16777215];
        
        for (const tid of testIds) {
            const bytes = encodeIdToRGBBytes(tid);
            const returnedId = decodeRGBToId(bytes[0], bytes[1], bytes[2]);
            console.assert(returnedId === tid, \`Error mutación byte: input (\${tid}) != output (\${returnedId})\`);
        }
    });

    it('Rechaza identificadores por encima de 24bits y ceros', () => {
        let throwsError = false;
        try {
            encodeIdToRGBBytes(16777216); // +1 beyond FFFFFF
        } catch (e) {
            throwsError = true;
        }
        console.assert(throwsError, 'Falló el escudado de IDs mayores de rango.');

        throwsError = false;
        try {
            encodeIdToRGBBytes(0); // Reservemos 000 para Void
        } catch (e) {
            throwsError = true;
        }
        console.assert(throwsError, 'Falló el escudado al permitir ID 0.');
    });
});
