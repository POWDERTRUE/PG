# TacticalContextMenuSystem (OMEGA V31)

El \`TacticalContextMenuSystem.js\` es el controlador en DOM que reemplaza las lógicas Legacy de canvas contextuales y svg-path menus.
Se sitúa sobre la capa \`#hud-layer\` u \`body\` y obedece a un esquema **Polar Math (Zero-GC)** de O(1).

## API de inicialización
El sistema es activado de forma reactiva al atrapar la señal enviada por interacciones físicas 3D (\`RaycastSelectionSystem\`).
  
- **Señal:** \`PG:OS:OPEN_CONTEXT_MENU\`
- **Args de Payload:** \`{ targetId, screenX, screenY, deterministicKey, massData }\`

Directamente expone internamente \`openMenu(x, y, data, scale)\` calculando el Clamping con las dimensiones de la pantalla.

## Interfaz de Output
Al registrar \`PG:HUD:TACTICAL_SELECT\`, los nodos seleccionables inyectan su señal nativa y en paralelo informan al EventBus de OMEGA:

\`\`\`json
{
  "index": 0,
  "actionId": "warp",
  "label": "WARP",
  "targetId": "uuid-planeta",
  "source": "TacticalContextMenuSystem",
  "ts": 1698882000000
}
\`\`\`

## OMEGA Zero-GC Linter Compliance
* Se prohíbe calcular el índice mediante instanciación recursiva de \`Event\`.
* Se calcula mediante la función pura exportada internamente: \`TacticalContextMenuSystem.polarIndexFromAngle\`.
