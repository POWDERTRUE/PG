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
        let modified = false;

        if (content.includes('import { services } from')) {
            content = content.replace(/import\s+{\s*services\s*}\s+from/g, 'import { Registry } from');
            modified = true;
        }
        
        if (content.includes('services.get(')) {
            content = content.replace(/services\.get\(/g, 'Registry.get(');
            modified = true;
        }

        if (content.includes('services.register(')) {
            content = content.replace(/services\.register\(/g, 'Registry.register(');
            modified = true;
        }

        if (content.includes('services.clear(')) {
            content = content.replace(/services\.clear\(/g, 'Registry.clear(');
            modified = true;
        }

        if (modified) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Upgraded to Registry: ${filePath}`);
        }
    }
});
