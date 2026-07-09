const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, 'uala_results.txt'), 'utf8');

// We split by "🔍 UALÁ NOTIFICATION RECORD #"
const records = content.split(/🔍 UALÁ NOTIFICATION RECORD #/);
console.log(`Found ${records.length - 1} Ualá notification records.`);

const parsed = [];
records.forEach((record, index) => {
    if (index === 0) return;
    
    // Extract title and text
    // E.g., "* android.title=String (something)"
    // or similar. Let's look for "android.title=" and "android.text=" inside the record
    const titleMatch = record.match(/android\.title=String \(([^)]+)\)/);
    const textMatch = record.match(/android\.text=String \(([^)]+)\)/);
    
    const title = titleMatch ? titleMatch[1] : null;
    const text = textMatch ? textMatch[1] : null;
    
    if (title || text) {
        parsed.push({
            index,
            title,
            text
        });
    }
});

console.log("Parsed notifications:");
console.log(JSON.stringify(parsed, null, 2));
