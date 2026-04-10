# 💻 ARQUITECTURA OMEGA V30: EL CÓDIGO FUENTE (Skeleton Base)

Este documento es la **Regla Absoluta de Arquitectura** para el proyecto Powder Galaxy (Tattoo Enterprise Pro). Contiene el esqueleto base validado y el Mega-Prompt maestro para la generación de nuevos módulos, usando el patrón estructural **ServiceLocator** (Registry).

## 1. EL NÚCLEO BACKEND (Orquestación de Red)

### `backend/server.js` (El Orquestador V8)
```javascript
const startApiServer = require('./apiServer');
const startWebSocketServer = require('./websocketServer');

// Seguridad global del V8
process.on('uncaughtException', (err) => console.error('[V8 FATAL]', err));
process.on('unhandledRejection', (err) => console.error('[V8 PROMISE FATAL]', err));

// Arranque en paralelo
(async () => {
    try {
        startApiServer();
        startWebSocketServer();
        console.log('🌌 [OMEGA V30] Servidores Cuánticos en línea.');
    } catch (error) {
        console.error('💥 Falla de ignición en el servidor maestro:', error);
    }
})();
```

### `backend/websocketServer.js` (Router Espacial)
```javascript
const WebSocket = require('ws');
const { WS_PORT } = require('./config/ports');

function startWebSocketServer() {
    const wss = new WebSocket.Server({ port: WS_PORT });

    console.log(`[WS] Servidor WebSocket corriendo en puerto ${WS_PORT}`);

    wss.on('connection', (ws) => {
        console.log('[WS] Nueva conexión OS detectada.');

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                switch (data.type) {
                    case 'PLANET_CLICKED':
                        handlePlanetClick(ws, data.payload);
                        break;
                }
            } catch (err) {
                console.error("WS Parse Error:", err);
            }
        });
    });
}

function handlePlanetClick(ws, payload) {
    const appMap = {
        'terminal': 'terminal',
        'browser': 'browser',
        'settings': 'settings',
        'explorer': 'explorer'
    };
    
    const targetApp = appMap[payload.planetId] || payload.planetId;
    
    ws.send(JSON.stringify({ type: 'OPEN_APP', payload: { app: targetApp } }));
}

module.exports = startWebSocketServer;
```

## 2. EL NÚCLEO FRONTEND Y SERVICE REGISTRY

### `frontend/src/engine/core/ServiceRegistry.js` (La Bóveda)
```javascript
/**
 * [OMEGA V30] ServiceRegistry
 * Patrón: Service Locator / Singleton
 */
export class ServiceRegistry {
    constructor() {
        this._services = new Map();
    }
    register(name, serviceInstance) {
        if (this._services.has(name)) {
            console.warn(`[ServiceRegistry] Alerta Espacial: El servicio '${name}' ya está registrado. Sobrescribiendo...`);
        }
        this._services.set(name, serviceInstance);
        console.log(`[ServiceRegistry] Sistema anclado exitosamente: ${name}`);
    }
    get(name) {
        if (!this._services.has(name)) {
            throw new Error(`[ServiceRegistry] Falla Crítica: El subsistema '${name}' no existe en el registro.`);
        }
        return this._services.get(name);
    }
    bootAll() {
        this._services.forEach((service, name) => {
            if (typeof service.init === 'function') {
                service.init();
                console.log(`[ServiceRegistry] Secuencia de inicio completada para: ${name}`);
            }
        });
    }
}
export const Registry = new ServiceRegistry();
```

### `frontend/src/engine/UniverseKernel.js` (Master Orchestrator)
```javascript
import * as THREE from 'three';
import { Registry } from './core/ServiceRegistry.js';
import { RenderPipeline } from './rendering/RenderPipeline.js';
import { CelestialPhysicsSystem } from './physics/CelestialPhysicsSystem.js';
import { UniverseNavigationSystem } from './navigation/UniverseNavigationSystem.js';
import { GalaxyGenerator } from './universe/GalaxyGenerator.js';
import { WindowManager } from '../windows/WindowManager.js';

export class UniverseKernel {
    constructor() {
        this.renderer = null;
        this.camera = null;
        this.scene = new THREE.Scene();
    }

    async boot() {
        try {
            Registry.register('kernel', this);

            // Fase 1: Setup
            const canvas = document.getElementById('pg-renderer');
            this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
            this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 15000);
            this.camera.position.set(0, 150, 400);

            Registry.register('camera', this.camera);

            // Fase 2 & 3: Pipeline
            const pipeline = new RenderPipeline(this.renderer, this.scene, this.camera);
            Registry.register('pipeline', pipeline);
            pipeline.start();

            // Fase 4: Sistemas Core
            const physics = new CelestialPhysicsSystem();
            Registry.register('physics', physics);

            const navigation = new UniverseNavigationSystem(this.camera, this.scene, this.renderer.domElement);
            Registry.register('navigation', navigation);

            // Fase 5: AWAIT Galaxy Generation (Crítico)
            const galaxyGen = new GalaxyGenerator(this.scene, physics);
            Registry.register('galaxyGen', galaxyGen);
            await galaxyGen.buildAsync();

            // Fase 6: Inyectar Sistemas al Bucle
            pipeline.addSystem(physics);
            pipeline.addSystem(navigation);

            // Fase 7: UI Handoff
            await this._mountUI();
            
        } catch (error) {
            console.error('[FATAL ERROR]', error);
        }
    }

    async _mountUI() {
        const windowManager = new WindowManager(document.getElementById('window-layer'), this.scene);
        Registry.register('WindowManager', windowManager);
        windowManager.initialize();
    }
}
```

---

## 📋 EL MEGA-PROMPT DE IMPLEMENTACIÓN (Ctrl+C / Ctrl+V)

Copia el siguiente bloque de texto exactamente como está y úsalo cada vez que necesites que yo (o cualquier otra IA) programe un módulo específico de esta arquitectura sin romper las reglas de tu ecosistema.

***
[SYSTEM INSTRUCTION: POWDER GALAXY OMEGA V30 ARCHITECTURE STRICT MODE]

Actúa como el Arquitecto de Software Principal y Senior WebGL Engineer del proyecto "Powder Galaxy (Tattoo Enterprise Pro)".

CONTEXTO DEL SISTEMA (OMEGA V30):
- Frontend: Three.js puro, arquitectura ES6 Modules sin DOM anidado clásico. 
- Gestión de Estado: Usamos un Patrón Singleton llamado `ServiceRegistry.js` (exportado como `Registry`) para inyectar y acceder a las dependencias. NO se deben pasar cientos de variables por los constructores, usa el `import { Registry } from '../core/ServiceRegistry.js'` y `Registry.get('nombre')` para comunicar clases.
- Bucle central manejado por `RenderPipeline.js` ejecutado vía `UniverseKernel.js`.

TAREA ACTUAL:
Analiza el error o el requerimiento solicitado por el usuario y escribe el código completo y optimizado para resolverlo.

REQUISITOS DE SALIDA:
1. Escribe el código en JavaScript moderno (ES6 Modules) sin declarar variables globales con el mismo nombre en el mismo scope.
2. Si el módulo requiere acceder a otro sistema (ej. la cámara o las físicas), impórtalo usando `import { Registry } from '../core/ServiceRegistry.js'` y llámalo con `Registry.get()`.
3. Comenta el código explicando cómo este archivo se comunica con los niveles adyacentes de la arquitectura.
4. Optimiza para mantener los 60-120 FPS.
5. Entrega la solución lista para copiar y pegar.
***
