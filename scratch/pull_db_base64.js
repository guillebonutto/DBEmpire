const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function pullFile(remotePath, localName) {
    try {
        console.log(`Pulling ${remotePath} via Base64...`);
        const base64Str = execSync(`adb shell run-as com.guille.digitalboostempire.dev base64 ${remotePath}`, {
            maxBuffer: 50 * 1024 * 1024 // 50MB buffer
        }).toString();
        // Remove whitespace and newlines
        const cleanBase64 = base64Str.replace(/\s/g, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        const localPath = path.join(__dirname, localName);
        fs.writeFileSync(localPath, buffer);
        console.log(`Saved ${localName} (${buffer.length} bytes)`);
    } catch (e) {
        console.log(`Could not pull ${remotePath}: ${e.message}`);
    }
}

pullFile('./files/SQLite/empire_local.db', 'empire_local.db');
pullFile('./files/SQLite/empire_local.db-wal', 'empire_local.db-wal');
pullFile('./files/SQLite/empire_local.db-shm', 'empire_local.db-shm');
