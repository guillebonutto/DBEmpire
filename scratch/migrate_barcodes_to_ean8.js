const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function calculateEan8CheckDigit(digits) {
    const d = digits.split('').map(Number);
    const sumOdd = d[0] + d[2] + d[4] + d[6];
    const sumEven = d[1] + d[3] + d[5];
    const total = sumOdd * 3 + sumEven;
    const check = (10 - (total % 10)) % 10;
    return check;
}

function isValidEan8(barcode) {
    if (!barcode) return false;
    if (!/^\d{8}$/.test(barcode)) return false;
    const base = barcode.substring(0, 7);
    const checkDigit = calculateEan8CheckDigit(base);
    return barcode[7] === String(checkDigit);
}

async function main() {
    console.log('Fetching all products...');
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, barcode')
        .eq('active', true);

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    console.log(`Fetched ${products.length} products.`);

    let currentNum = 1000001;
    const updates = [];

    // Collect all existing valid EAN-8 barcodes in DB first to avoid collisions
    const existingValidEans = new Set();
    products.forEach(p => {
        if (isValidEan8(p.barcode)) {
            existingValidEans.add(p.barcode);
        }
    });

    for (const p of products) {
        if (isValidEan8(p.barcode)) {
            console.log(`Product "${p.name}" already has valid EAN-8: ${p.barcode}. Skipping.`);
            continue;
        }

        // Generate next unique EAN-8
        let candidate = '';
        while (true) {
            const base = String(currentNum);
            const check = calculateEan8CheckDigit(base);
            candidate = `${base}${check}`;
            currentNum++;
            if (!existingValidEans.has(candidate)) {
                existingValidEans.add(candidate);
                break;
            }
        }

        console.log(`Migrating "${p.name}": "${p.barcode}" -> "${candidate}"`);
        updates.push({ id: p.id, barcode: candidate });
    }

    console.log(`Starting ${updates.length} database updates...`);
    for (const item of updates) {
        const { error: updateError } = await supabase
            .from('products')
            .update({ barcode: item.barcode })
            .eq('id', item.id);

        if (updateError) {
            console.error(`Failed to update product ${item.id}:`, updateError);
        } else {
            console.log(`Product ${item.id} successfully updated to ${item.barcode}`);
        }
    }

    console.log('Migration finished successfully!');
}

main();
