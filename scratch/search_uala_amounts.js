const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, 'uala_results.txt'), 'utf8');

// Look for lines containing numbers like XX.XXX or $X.XXX
const lines = content.split('\n');
console.log(`Searching for numbers in uala_results.txt...`);
lines.forEach((line, idx) => {
    if (line.includes('$') || line.match(/\b\d{1,3}[.,]\d{3}\b/) || line.includes('mText') || line.includes('mTitle')) {
        console.log(`${idx + 1}: ${line.trim().slice(0, 120)}`);
    }
});
