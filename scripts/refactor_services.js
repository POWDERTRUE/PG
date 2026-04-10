const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

const frontendSrc = path.join(__dirname, '../frontend/src');

walkDir(frontendSrc, (filePath) => {
    if (filePath.endsWith('.js')) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // If file uses services.get or services.register but doesn't import services
        if (/(?:services|this\.services)\.(?:get|register)\(/.test(content)) {
            if (!content.includes('ServiceRegistry.js')) {
                // Calculate relative path to ServiceRegistry.js
                // ServiceRegistry.js is at frontend/src/engine/core/ServiceRegistry.js
                const registryPath = path.join(frontendSrc, 'engine/core/ServiceRegistry.js');
                let relPath = path.relative(path.dirname(filePath), registryPath).replace(/\\/g, '/');
                if (!relPath.startsWith('.')) relPath = './' + relPath;
                
                // Add import at the top after initial block comments if any
                const importStmt = `import { services } from '${relPath}';\n`;
                
                // Simple injection at the start after imports
                const lines = content.split('\n');
                let lastImportIndex = 0;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].startsWith('import ')) {
                        lastImportIndex = i + 1;
                    }
                }
                
                lines.splice(lastImportIndex, 0, importStmt);
                
                // Also, if the file has constructor(services), let's remove the argument and the assignment `this.services = services` so it uses the imported singleton
                // Actually, let's just globally replace `this.services.get` with `services.get` to ensure it uses the singleton
                let newContent = lines.join('\n');
                newContent = newContent.replace(/this\.services\.get\(/g, 'services.get(');
                
                fs.writeFileSync(filePath, newContent, 'utf8');
                console.log(`Patched: ${filePath}`);
            }
        }
    }
});
