const express = require("express");
const path = require("path");
const { API_PORT } = require("./config/ports");

function startApiServer() {
    return new Promise((resolve, reject) => {
        const app = express();

        app.use(express.json());

        // ── Cross-Origin Isolation — required for SharedArrayBuffer ──────────
        app.use((req, res, next) => {
            res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
            res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
            next();
        });

        // Serve static frontend
        const frontendPath = path.join(__dirname, "../frontend");
        app.use(express.static(frontendPath));

        app.get("/status", (req, res) => {
            res.json({ status: "Galaxy API running" });
        });

        const server = app.listen(API_PORT, (err) => {
            if (err) return reject(err);
            console.log(`[API] Server running on port ${API_PORT}`);
            resolve(server);
        });

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                reject(new Error(`API Port ${API_PORT} is already in use by another process.`));
            } else {
                reject(err);
            }
        });
    });
}

module.exports = startApiServer;
