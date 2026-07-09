const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'uala_raw_record.txt');
if (!fs.existsSync(filePath)) {
    console.error("File not found:", filePath);
    process.exit(1);
}

const lines = fs.readFileSync(filePath, 'utf8').split('\n');
let inRecord = false;
let recordNum = 0;
let extrasLines = [];
let inExtras = false;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('UALÁ NOTIFICATION RECORD')) {
        recordNum++;
        console.log(`\n==============================================`);
        console.log(`Ualá Record #${recordNum}`);
        inRecord = true;
        inExtras = false;
        extrasLines = [];
        continue;
    }
    
    if (inRecord) {
        if (line.includes('extras={')) {
            inExtras = true;
            continue;
        }
        if (inExtras) {
            if (line.includes('}')) {
                inExtras = false;
                inRecord = false;
                // Print all non-null extras
                extrasLines.forEach(el => console.log(el.trim()));
            } else {
                extrasLines.push(line);
            }
        }
    }
}

