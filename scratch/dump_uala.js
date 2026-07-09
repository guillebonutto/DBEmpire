const { execSync } = require('child_process');

try {
    console.log("Dumping dumpsys notification...");
    const raw = execSync('adb shell dumpsys notification').toString();
    const lines = raw.split('\n');
    
    console.log(`Total lines dumped: ${lines.length}`);
    
    // Find lines that contain "ar.com.bancar.uala"
    let count = 0;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('ar.com.bancar.uala')) {
            console.log(`\n--- MATCH ${++count} at line ${i + 1} ---`);
            // Print this line and the next 25 lines
            for (let j = 0; j < 30; j++) {
                if (i + j < lines.length) {
                    console.log(lines[i + j]);
                }
            }
        }
    }
} catch (e) {
    console.error("Error:", e.message);
}
