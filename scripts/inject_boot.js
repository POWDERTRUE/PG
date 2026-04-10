const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '../frontend/pages');

fs.readdirSync(pagesDir).forEach(file => {
    if (file.endsWith('.html')) {
        const filePath = path.join(pagesDir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Remove individual script tags loaded by boot.js
        const scriptsToRemove = [
            'systems/misc/bootstrap-os.js',
            'systems/misc/gallery.js', // let's leave gallery.js mostly alone? Actually it's page specific.
            'systems/effects/cursor-effects.js',
            'systems/universe/scroll-zoom-controller.js',
            'ui/bubble-navbar.js',
            'systems/intelligence/usage-intelligence.js',
            'systems/window-system/spatial-layout.js',
            'systems/universe/galaxy-background.js',
            'systems/universe/universe-camera.js',
            'systems/universe/universe-map.js',
            'systems/universe/orbit-system.js',
            'systems/misc/avatar-system.js',
            'core/realtime-client.js',
            'systems/effects/spatial-effects.js',
            'systems/effects/gravity-system.js',
            'systems/effects/portal-animation.js',
            'systems/window-system/snap-system.js',
            'ui/dock-manager.js',
            'systems/window-system/window-manager.js',
            'systems/window-system/window-state.js',
            'systems/misc/antigravity-ui.js'
        ];

        scriptsToRemove.forEach(script => {
            const regex = new RegExp(`<script src="${script}"></script>\\s*`, 'g');
            content = content.replace(regex, '');
        });

        // Insert <script type="module" src="../core/boot.js"></script> before </body>
        // Note: we'll use '../core/boot.js' or just 'core/boot.js', Express serves frontend/pages via static, but we'll use absolute '/core/boot.js' to make sure. Wait, express serves `frontend` and `frontend/pages`. 
        // Best is `/core/boot.js`. And CSS is `/styles/os-core.css` if we change it.
        
        // Ensure boot.js gets injected if not already there
        if (!content.includes('boot.js')) {
            content = content.replace('</body>', '    <script type="module" src="/core/boot.js"></script>\n</body>');
        }

        fs.writeFileSync(filePath, content);
        console.log(`Updated ${file} to use unified boot.js`);
    }
});
