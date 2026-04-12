// vite.config.js — OMEGA V31 Build Orchestrator
// ─────────────────────────────────────────────────────────────────────────────
// ARQUITECTURA DE CHUNKS:
//   vendor       → three.js + postprocessing + gsap  (~680 kB, caché permanente)
//   engine-core  → ServiceRegistry, FrameScheduler, EventBus, UniverseKernel  (~130 kB)
//   index        → main.js bootstrap  (<10 kB, siempre fresco)
//
// LEY HMR: Los módulos dentro de engine/core/ usan import.meta.hot.decline()
//          para forzar full-page reload y prevenir estado zombi con Registry.freeze().
// ─────────────────────────────────────────────────────────────────────────────

import { defineConfig } from 'vite';
import { resolve }      from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({

    // ── Raíz del frontend (index.html vive aquí) ────────────────────────────
    root:      resolve(__dirname, 'frontend'),
    publicDir: resolve(__dirname, 'frontend/public'),

    // ── Base URL: relativa para compatibilidad con Express estático ──────────
    base: './',

    // ─────────────────────────────────────────────────────────────────────────
    // BUILD CONFIG
    // ─────────────────────────────────────────────────────────────────────────
    build: {
        outDir:     resolve(__dirname, 'frontend/dist'),
        emptyOutDir: true,
        sourcemap:   false,  // Activar con 'inline' si se necesita depurar prod

        // TRATADO DE CHUNKING — Separación determinista del bundle
        rollupOptions: {
            input: resolve(__dirname, 'frontend/index.html'),

            output: {
                // Naming pattern con hash para cache-busting permanente
                chunkFileNames:  'assets/[name]-[hash].js',
                entryFileNames:  'assets/[name]-[hash].js',
                assetFileNames:  'assets/[name]-[hash][extname]',

                manualChunks(id) {
                    const nid = id.replace(/\\/g, '/');
                    
                    // 1. VENDOR CHUNKS (Must be checked first)
                    if (
                        nid.includes('node_modules/three') ||
                        nid.includes('node_modules/postprocessing') ||
                        nid.includes('node_modules/gsap') ||
                        nid.includes('node_modules/html2canvas')
                    ) {
                        return 'vendor';
                    }

                    if (
                        nid.includes('node_modules/stats.js') ||
                        nid.includes('node_modules/lil-gui') ||
                        nid.includes('node_modules/socket.io-client') ||
                        nid.includes('node_modules/engine.io-client') ||
                        nid.includes('node_modules/@socket.io')
                    ) {
                        return 'vendor-util';
                    }

                    // 2. ENGINE CORE CHUNK
                    // The rigid immutable infrastructure of the engine
                    // if (
                    //     nid.includes('/engine/core/') ||
                    //     nid.includes('/src/core/') ||
                    //     nid.includes('UniverseKernel.js')
                    // ) {
                    //     return 'engine-core';
                    // }
                },
            },
        },

        // El vendor chunk excede 500kB intencionalmente — es Three.js + GSAP + PP.
        // No es código muerto; es el motor matemático. Límite elevado a 1000kB.
        chunkSizeWarningLimit: 1000,
    },

    // ─────────────────────────────────────────────────────────────────────────
    // DEV SERVER CONFIG
    // ─────────────────────────────────────────────────────────────────────────
    server: {
        port: 5173,
        open: false,

        // Proxy WebSocket al backend (puerto 5556) durante desarrollo
        proxy: {
            '/socket.io': {
                target:      'ws://localhost:5556',
                ws:          true,
                changeOrigin: true,
            },
            '/api': {
                target:      'http://localhost:5555',
                changeOrigin: true,
            },
        },

        // ── Protocolo Anti-Zombi (HMR + Registry.freeze()) ──────────────────
        // Los cambios en engine/core/ fuerzan full-page reload para evitar
        // que el HMR intente hot-patch un registro congelado (estado zombi).
        // Esta regla trabaja junto con import.meta.hot.decline() en cada módulo core.
        watch: {
            // Patrón de archivos que disparan full reload en lugar de HMR patch
        },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // RESOLUCIÓN DE MÓDULOS
    // ─────────────────────────────────────────────────────────────────────────
    resolve: {
        alias: {
            // Permite imports desde '@engine/...' como alias limpio
            '@engine': resolve(__dirname, 'frontend/src/engine'),
            '@core':   resolve(__dirname, 'frontend/src/core'),
            '@ui':     resolve(__dirname, 'frontend/src/ui'),
            '@src':    resolve(__dirname, 'frontend/src'),
        },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // OPTIMIZACIÓN DE DEPENDENCIAS (Pre-bundling)
    // Vite pre-bundlea estas libs a ESM para HMR instantáneo en dev
    // ─────────────────────────────────────────────────────────────────────────
    optimizeDeps: {
        include: [
            'three',
            'gsap',
            'postprocessing',
            'stats.js',
            'lil-gui',
            'socket.io-client',
        ],
    },
});
