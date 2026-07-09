const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\Guille\\.gemini\\antigravity-ide\\brain\\455f23f9-b4a1-4fa1-a0d7-4e59f9330984\\.system_generated\\logs\\transcript.jsonl';

if (!fs.existsSync(logPath)) {
    console.error("Transcript file not found at:", logPath);
    process.exit(1);
}

const lines = fs.readFileSync(logPath, 'utf8').split('\n');
console.log(`Searching through ${lines.length} log steps...`);

// Print the last 15 USER inputs or error responses
let userCount = 0;
for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line.trim()) continue;
    try {
        const obj = JSON.parse(line);
        if (obj.type === 'USER_INPUT' || (obj.content && obj.content.includes('Error'))) {
            console.log(`\n--- Step ${obj.step_index || i} | Type: ${obj.type} | Source: ${obj.source} ---`);
            console.log(obj.content ? obj.content.substring(0, 1000) : "No text content");
            userCount++;
            if (userCount > 10) break;
        }
    } catch (e) {
    }
}
