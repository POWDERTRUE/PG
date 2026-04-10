const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '../frontend/pages');

fs.readdirSync(pagesDir).forEach(file => {
    if (file.endsWith('.html')) {
        const filePath = path.join(pagesDir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Remove old CSS links
        content = content.replace(/<link rel="stylesheet" href="styles\/os-core\.css">\s*/g, '');
        content = content.replace(/<link rel="stylesheet" href="styles\/os-windows\.css">\s*/g, '');
        content = content.replace(/<link rel="stylesheet" href="styles\/os-ui\.css">\s*/g, '');
        content = content.replace(/<link rel="stylesheet" href="styles\/os-effects\.css">\s*/g, '');
        
        // Let's also check for style.css and glass-ui.css that might exist
        content = content.replace(/<link rel="stylesheet" href="styles\/style\.css">\s*/g, '');
        content = content.replace(/<link rel="stylesheet" href="styles\/glass-ui\.css">\s*/g, '');

        // Insert new main.css right before </head> if not already there
        if (!content.includes('styles/main.css')) {
            content = content.replace('</head>', '    <link rel="stylesheet" href="/styles/main.css">\n</head>');
        }

        fs.writeFileSync(filePath, content);
        console.log(`Updated ${file} CSS links`);
    }
});
