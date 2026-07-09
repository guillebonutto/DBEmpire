const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, 'uala_results.txt'), 'utf8');
const lines = content.split('\n');

console.log("Searching for 207 in uala_results.txt...");
lines.forEach((line, idx) => {
    if (line.includes('207')) {
        console.log(`\n--- Match at line ${idx + 1} ---`);
        for (let i = Math.max(0, idx - 5); i <= Math.min(lines.length - 1, idx + 5); i++) {
            console.log(`${i + 1}: ${lines[i]}`);
        }
    }
});
