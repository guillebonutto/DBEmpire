const { execSync } = require('child_process');

function getNotifications() {
    try {
        console.log("Checking for connected ADB devices...");
        const devicesOutput = execSync('adb devices').toString();
        console.log(devicesOutput);

        if (!devicesOutput.includes('\tdevice')) {
            console.log("⚠️ No Android devices found connected via ADB. Please make sure:");
            console.log("1. Your phone is connected to the PC via USB.");
            console.log("2. USB Debugging is enabled in Developer Options on your phone.");
            console.log("3. You authorized the connection on your phone screen.");
            return;
        }

        console.log("Fetching notifications from device...");
        const output = execSync('adb shell dumpsys notification').toString();
        
        // Split by NotificationRecord to parse individual notifications
        const records = output.split(/NotificationRecord\(/);
        const parsedNotifications = [];

        for (let i = 1; i < records.length; i++) {
            const record = records[i];
            
            // Extract package name
            const pkgMatch = record.match(/pkg=([\w.]+)/);
            if (!pkgMatch) continue;
            const pkg = pkgMatch[1];

            // Only extract title/text from extras
            const titleMatch = record.match(/android\.title=String\s*\((.*?)\)/);
            const textMatch = record.match(/android\.text=String\s*\((.*?)\)/);
            const subTextMatch = record.match(/android\.subText=String\s*\((.*?)\)/);

            if (titleMatch || textMatch) {
                parsedNotifications.push({
                    package: pkg,
                    title: titleMatch ? titleMatch[1] : 'N/A',
                    text: textMatch ? textMatch[1] : 'N/A',
                    subText: subTextMatch ? subTextMatch[1] : ''
                });
            }
        }

        console.log(`\n=== ACTIVE NOTIFICATIONS FOUND (${parsedNotifications.length}) ===\n`);
        
        // Filter notifications of interest (e.g. Uala, Mercado Pago, Banks)
        const financeNotifications = parsedNotifications.filter(n => 
            n.package.toLowerCase().includes('uala') || 
            n.package.toLowerCase().includes('mercadopago') || 
            n.package.toLowerCase().includes('bank') ||
            n.title.toLowerCase().includes('transferencia') ||
            n.text.toLowerCase().includes('recibiste') ||
            n.text.toLowerCase().includes('transferencia')
        );

        if (financeNotifications.length > 0) {
            console.log("--- 💰 RELEVANT FINANCE / TRANSFER NOTIFICATIONS ---");
            financeNotifications.forEach((n, idx) => {
                console.log(`[${idx + 1}] App: ${n.package}`);
                console.log(`    Title: ${n.title}`);
                console.log(`    Text:  ${n.text}`);
                if (n.subText) console.log(`    Sub:   ${n.subText}`);
                console.log("-".repeat(40));
            });
        } else {
            console.log("No active finance/transfer notifications detected.");
        }

        console.log("\n--- 📱 ALL ACTIVE NOTIFICATIONS ---");
        parsedNotifications.slice(0, 15).forEach((n, idx) => {
            console.log(`[${idx + 1}] ${n.package} | Title: "${n.title}" | Text: "${n.text}"`);
        });

        if (parsedNotifications.length > 15) {
            console.log(`... and ${parsedNotifications.length - 15} more notifications.`);
        }

    } catch (error) {
        console.error("Error executing command:", error.message);
    }
}

getNotifications();
