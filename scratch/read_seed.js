const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'assets', 'seed_data.json');
if (fs.existsSync(file)) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    console.log("Keys in seed data:", Object.keys(data));
    if (data.expenses) {
        console.log(`Seed has ${data.expenses.length} expenses.`);
    }
    if (data.supplier_orders) {
        console.log(`Seed has ${data.supplier_orders.length} supplier orders.`);
        console.log("Seed supplier orders:", data.supplier_orders.map(o => ({ id: o.id, provider_name: o.provider_name, installments_paid: o.installments_paid, installments_total: o.installments_total })));
    }
} else {
    console.log("Seed data file does not exist.");
}
