const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'uala_results.txt');
if (!fs.existsSync(filePath)) {
    console.error("File not found:", filePath);
    process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log(`Scanning ${lines.length} lines in uala_results.txt...`);
let matchCount = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('android.title') || line.includes('android.text') || line.includes('android.bigText') || line.includes('Nancy')) {
        matchCount++;
        console.log(`Line ${i + 1}: ${line.trim()}`);
        if (matchCount > 100) {
            console.log("... truncated (too many matches) ...");
            break;
        }
    }
}
