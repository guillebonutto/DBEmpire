const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'assets', 'seed_data.json');
if (fs.existsSync(file)) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    
    // Look at expenses in seed data
    if (data.expenses) {
        data.expenses.forEach(e => {
            const amt = Math.abs(parseFloat(e.amount));
            if (Math.abs(amt - 207) < 5) {
                console.log("Expense match:", e);
            }
        });
    }
    // Look at sales
    if (data.sales) {
        data.sales.forEach(s => {
            const amt = Math.abs(parseFloat(s.total_amount));
            if (Math.abs(amt - 207) < 5) {
                console.log("Sale match:", s);
            }
        });
    }
}
