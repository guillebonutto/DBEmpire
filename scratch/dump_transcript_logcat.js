const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\Guille\\.gemini\\antigravity-ide\\brain\\5af21011-050c-4652-838e-5b8af9cf89aa\\.system_generated\\logs\\transcript.jsonl';

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
        const contentStr = JSON.stringify(obj);
        if (contentStr.toLowerCase().includes('logcat') || contentStr.toLowerCase().includes('dumpsys') || contentStr.toLowerCase().includes('adb')) {
            console.log(`\n==================================================`);
            console.log(`Step: ${obj.step_index} | Type: ${obj.type}`);
            console.log(`==================================================`);
            if (obj.content) {
                // If this is a command output, print it
                console.log(obj.content.substring(0, 2000));
            } else if (obj.tool_calls) {
                console.log(JSON.stringify(obj.tool_calls));
            }
        }
    } catch (e) {}
}
