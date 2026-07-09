const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\Guille\\.gemini\\antigravity-ide\\brain';
const outputPath = path.join(__dirname, 'notification_details.txt');

if (!fs.existsSync(brainDir)) {
    console.error("Brain directory not found:", brainDir);
    process.exit(1);
}

const folders = fs.readdirSync(brainDir);
let results = "";

folders.forEach(folder => {
    const logPath = path.join(brainDir, folder, '.system_generated', 'logs', 'transcript.jsonl');
    if (fs.existsSync(logPath)) {
        const content = fs.readFileSync(logPath, 'utf8');
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;
            try {
                const obj = JSON.parse(line);
                const contentStr = JSON.stringify(obj);
                
                // Search for today's logs or Uala logs
                if (contentStr.includes('02:29') || contentStr.includes('02:30') || contentStr.includes('02:28')) {
                    if (contentStr.includes('bancar.uala') || contentStr.includes('Notification') || contentStr.includes('com.guille.digitalboostempire')) {
                        results += `\n==================================================\n`;
                        results += `FOLDER: ${folder} | Step: ${obj.step_index} | Type: ${obj.type}\n`;
                        results += `==================================================\n`;
                        results += obj.content || JSON.stringify(obj);
                        results += `\n`;
                    }
                }
            } catch (e) {}
        }
    }
});

if (results) {
    fs.writeFileSync(outputPath, results);
    console.log("Found matches! Saved to:", outputPath);
} else {
    fs.writeFileSync(outputPath, "No matches found for today's notification.");
    console.log("No matches found.");
}
