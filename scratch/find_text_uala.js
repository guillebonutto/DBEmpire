const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, 'uala_results.txt'), 'utf8');
const lines = content.split('\n');

console.log("Searching for strings inside notification records...");
lines.forEach((line, idx) => {
    // If line has double quotes, single quotes, or looks like it contains text content
    if (line.includes('ar.com.bancar.uala') && (line.includes('Text') || line.includes('title') || line.includes('ticker') || line.includes('message') || line.includes('body'))) {
        console.log(`${idx + 1}: ${line.trim().slice(0, 150)}`);
    }
    // Print lines containing numbers and words like "recibido", "transferencia", "compra", "pago"
    const lower = line.toLowerCase();
    if (lower.includes('recibi') || lower.includes('transf') || lower.includes('compra') || lower.includes('pago') || lower.includes('gasto') || lower.includes('saldo')) {
        console.log(`${idx + 1}: ${line.trim().slice(0, 150)}`);
    }
});
