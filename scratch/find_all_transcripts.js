const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\Guille\\.gemini\\antigravity-ide\\brain';

if (!fs.existsSync(brainDir)) {
    console.error("Brain directory not found:", brainDir);
    process.exit(1);
}

const folders = fs.readdirSync(brainDir);
console.log(`Found ${folders.length} folders in brain directory.`);

folders.forEach(folder => {
    const logPath = path.join(brainDir, folder, '.system_generated', 'logs', 'transcript.jsonl');
    if (fs.existsSync(logPath)) {
        console.log(`Scanning: ${logPath}`);
        const content = fs.readFileSync(logPath, 'utf8');
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;
            try {
                const obj = JSON.parse(line);
                const contentStr = JSON.stringify(obj).toLowerCase();
                if (contentStr.includes('nancy') || contentStr.includes('molina') || contentStr.includes('02:29')) {
                    console.log(`\n==================================================`);
                    console.log(`MATCH IN FOLDER: ${folder} | Step: ${obj.step_index}`);
                    console.log(`==================================================`);
                    if (obj.content) {
                        console.log(obj.content.substring(0, 1500));
                    } else {
                        console.log(JSON.stringify(obj).substring(0, 1000));
                    }
                }
            } catch (e) {}
        }
    }
});
