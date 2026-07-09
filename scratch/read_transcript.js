const fs = require('fs');
const path = require('path');

// Locate transcript.jsonl in previous conversation
const logPath = 'C:\\Users\\Guille\\.gemini\\antigravity-ide\\brain\\5af21011-050c-4652-838e-5b8af9cf89aa\\.system_generated\\logs\\transcript.jsonl';

if (!fs.existsSync(logPath)) {
    console.error("Transcript file not found at:", logPath);
    process.exit(1);
}

const lines = fs.readFileSync(logPath, 'utf8').split('\n');
console.log(`Searching through ${lines.length} log steps...`);

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    try {
        const obj = JSON.parse(line);
        const contentStr = JSON.stringify(obj);
        if (contentStr.includes('02:29:') || contentStr.includes('bancar.uala') || contentStr.includes('Recibiste')) {
            console.log(`\n--- Match in step ${obj.step_index || i} (${obj.type || 'unknown'}) ---`);
            const snippet = contentStr.substring(0, 1000);
            console.log(snippet);
            
            if (obj.content && (obj.content.includes('02:29:') || obj.content.includes('Recibiste'))) {
                console.log("Full Content:");
                console.log(obj.content);
            }
        }
    } catch (e) {
    }
}

