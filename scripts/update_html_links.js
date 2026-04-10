const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '../frontend/pages');

const replacements = {
    'css/': 'styles/',
    'images/': 'assets/images/',
    'js/auth.js': 'systems/misc/auth.js',
    'js/main.js': 'systems/misc/bootstrap-os.js', // Taking an educated guess that main was bootstrap-os
    'js/gallery.js': 'systems/misc/gallery.js',
    'js/cursor-effects.js': 'systems/effects/cursor-effects.js',
    'js/scroll-zoom-controller.js': 'systems/universe/scroll-zoom-controller.js',
    'js/bubble-navbar.js': 'ui/bubble-navbar.js',
    'js/usage-intelligence.js': 'systems/intelligence/usage-intelligence.js',
    'js/spatial-layout.js': 'systems/window-system/spatial-layout.js',
    'js/galaxy-background.js': 'systems/universe/galaxy-background.js',
    'js/universe-camera.js': 'systems/universe/universe-camera.js',
    'js/universe-map.js': 'systems/universe/universe-map.js',
    'js/orbit-system.js': 'systems/universe/orbit-system.js',
    'js/avatar-system.js': 'systems/misc/avatar-system.js',
    'js/realtime-client.js': 'core/realtime-client.js',
    'js/spatial-effects.js': 'systems/effects/spatial-effects.js',
    'js/gravity-system.js': 'systems/effects/gravity-system.js',
    'js/portal-animation.js': 'systems/effects/portal-animation.js',
    'js/snap-system.js': 'systems/window-system/snap-system.js',
    'js/dock-manager.js': 'ui/dock-manager.js',
    'js/window-manager.js': 'systems/window-system/window-manager.js',
    'js/window-state.js': 'systems/window-system/window-state.js',
    'js/antigravity-ui.js': 'systems/misc/antigravity-ui.js',
    'href="index.html"': 'href="/"',
    'href="artists.html"': 'href="/artists.html"',
    'href="gallery.html"': 'href="/gallery.html"',
    'href="booking.html"': 'href="/booking.html"',
    'href="contact.html"': 'href="/contact.html"',
    'href="login.html"': 'href="/login.html"',
    'href="register.html"': 'href="/register.html"'
};

fs.readdirSync(pagesDir).forEach(file => {
    if (file.endsWith('.html')) {
        const filePath = path.join(pagesDir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        
        for (const [key, value] of Object.entries(replacements)) {
            content = content.replace(new RegExp(key, 'g'), value);
        }
        
        fs.writeFileSync(filePath, content);
        console.log(`Updated ${file}`);
    }
});
