# Powder Galaxy OMEGA V30

Motor espacial 3D en tiempo real con arquitectura por sistemas, UI holográfica y asistente operativo LULU.

## Requisitos

- Node.js 18+
- npm 9+
- Navegador moderno con WebGL2

## Arranque rápido

```bash
npm install
npm start
```

- API/servidor estático: `http://localhost:5555`
- WebSocket: `ws://localhost:5556`

## Scripts

- `npm start`: arranque normal (`backend/server.js`)
- `npm run dev`: arranque con `nodemon`
- `npm test`: placeholder (todavía sin suite formal)

## Estructura principal

- `backend/`: API y WebSocket
- `frontend/`: cliente del universo (kernel, render, navegación, UI, LULU)
- `ALBUM_UNIVERSAL/`: documentación técnica canónica
- `LULU_UNIVERSE_BIBLE_P*.md`: biblia de universo por capítulos

## LULU

En runtime puedes usar:

- `estado del universo`
- `encuadra galaxia`
- `docs galaxia`
- `inspecciona sistema navigation`
- `crear planeta volcanico`

## Estado actual

El proyecto contiene módulos legacy no conectados al `main` actual. La base activa vive en `frontend/src/main.js` y `frontend/src/engine/UniverseKernel.js`.
