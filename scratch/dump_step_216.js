const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\Guille\\.gemini\\antigravity-ide\\brain\\455f23f9-b4a1-4fa1-a0d7-4e59f9330984\\.system_generated\\logs\\transcript.jsonl';

if (!fs.existsSync(logPath)) {
    console.error("Transcript file not found at:", logPath);
    process.exit(1);
}

const lines = fs.readFileSync(logPath, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    try {
        const obj = JSON.parse(line);
        // We look for steps 214, 215, 216, 217
        if (obj.step_index >= 180 && obj.step_index <= 210) {
            console.log(`\n==================================================`);
            console.log(`Step: ${obj.step_index} | Type: ${obj.type} | Source: ${obj.source}`);
            console.log(`==================================================`);
            console.log(JSON.stringify(obj, null, 2));
        }
    } catch (e) {}
}
