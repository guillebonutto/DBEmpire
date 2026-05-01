const fs = require('fs');
const path = require('path');

const zustandDir = path.join(__dirname, 'node_modules', 'zustand');
const PATTERN = /import\.meta\.env\s*\?\s*import\.meta\.env\.MODE\s*:\s*void 0/g;
const REPLACEMENT = 'process.env.NODE_ENV';

let patchedFiles = 0;

function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs') || entry.name.endsWith('.cjs'))) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (PATTERN.test(content)) {
                const patched = content.replace(PATTERN, REPLACEMENT);
                fs.writeFileSync(fullPath, patched, 'utf8');
                console.log(`✅ Patched: ${fullPath}`);
                patchedFiles++;
            }
            // Reset lastIndex after .test()
            PATTERN.lastIndex = 0;
        }
    }
}

walk(zustandDir);
console.log(`\nDone. ${patchedFiles} file(s) patched.`);
