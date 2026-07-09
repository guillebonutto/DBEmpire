const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, 'uala_results.txt'), 'utf8');
const lines = content.split('\n');
console.log(`Total lines: ${lines.length}`);

// Find lines containing numbers like 94628 or close to it
lines.forEach((line, i) => {
    if (line.includes('94628') || line.includes('94.628') || line.toLowerCase().includes('saldo') || line.toLowerCase().includes('balance')) {
        console.log(`${i}: ${line.slice(0, 150)}`);
    }
});
