const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
    console.log("Fetching active notification records for Ualá...");
    const raw = execSync('adb shell dumpsys notification').toString();
    
    // Split by NotificationRecord(
    const records = raw.split(/NotificationRecord\(/);
    
    let ualaCount = 0;
    let outputText = "";

    for (let i = 1; i < records.length; i++) {
        const record = records[i];
        if (record.includes('pkg=ar.com.bancar.uala')) {
            ualaCount++;
            outputText += `\n==============================================\n`;
            outputText += `🔍 UALÁ NOTIFICATION RECORD #${ualaCount}\n`;
            outputText += `==============================================\n`;
            outputText += record;
        }
    }

    if (ualaCount === 0) {
        outputText = "❌ No active Ualá notification records found in the dumpsys.\n";
    }

    const outputPath = path.join(__dirname, 'uala_raw_record.txt');
    fs.writeFileSync(outputPath, outputText);
    console.log(`Saved raw output to: ${outputPath}`);

} catch (e) {
    console.error("Error:", e.message);
}
