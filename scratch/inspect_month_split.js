const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supFile = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'supabase.js'), 'utf8');
const urlMatch = supFile.match(/SUPABASE_URL\s*=\s*'([^']+)'/);
const keyMatch = supFile.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
    const { data: sales } = await supabase.from('sales').select('*');
    const { data: expenses } = await supabase.from('expenses').select('*');

    const completedSales = (sales || []).filter(s => {
        const st = (s.status || '').toLowerCase();
        return st === 'completed' || st === 'exitosa' || st === 'vended' || st === '';
    });

    const isDebtPayment   = (e) => e.category === 'Pago de Deuda';
    const isBankYield     = (e) => e.category === 'Rendimiento Bancario';
    const isInitialCreditStock = (e) => {
        const desc = (e.description || '').toLowerCase();
        return desc.includes('crédito') || desc.includes('credito') || desc.includes('consignacion') || desc.includes('consignación') || desc.includes('consolidado') || desc.startsWith('inventario:');
    };

    const months = [2, 3]; // March and April (0-based: index 2 and 3)
    for (const month of months) {
        const startMs = new Date(2026, month, 1).getTime();
        const endMs   = new Date(2026, month + 1, 0, 23, 59, 59, 999).getTime();

        let prevIncome = 0, prevExpCaja = 0;
        let totalSales = 0, bankYields = 0, totalExpensesCaja = 0;

        for (const s of completedSales) {
            const sMs = new Date(s.created_at).getTime();
            if (sMs < startMs) {
                prevIncome += (parseFloat(s.total_amount) || 0);
            } else if (sMs <= endMs) {
                totalSales += (parseFloat(s.total_amount) || 0);
            }
        }

        for (const e of expenses) {
            const eMs = new Date(e.created_at).getTime();
            const val = parseFloat(e.amount) || 0;
            const isDebt = isDebtPayment(e);
            const isYield = isBankYield(e);
            const isStock = isInitialCreditStock(e);

            if (eMs < startMs) {
                if (!isStock) prevExpCaja += val;
            } else if (eMs <= endMs) {
                if (isYield) {
                    bankYields += val;
                } else {
                    const isExcluded = isDebt || isYield || isStock;
                    const cjaVal = isExcluded ? 0 : val;
                    const finalVal = isDebt ? val : cjaVal;
                    totalExpensesCaja += finalVal;
                }
            }
        }

        const histBalCaja = prevIncome - prevExpCaja;
        const netCaja = histBalCaja + totalSales - bankYields - totalExpensesCaja;

        console.log(`\n=== MONTH: ${month + 1} (startMs: ${new Date(startMs).toLocaleDateString()}) ===`);
        console.log(`prevIncome:         $${prevIncome.toFixed(2)}`);
        console.log(`prevExpCaja:        $${prevExpCaja.toFixed(2)}`);
        console.log(`histBalCaja:        $${histBalCaja.toFixed(2)}`);
        console.log(`totalSales:         $${totalSales.toFixed(2)}`);
        console.log(`bankYields (raw):   $${bankYields.toFixed(2)}`);
        console.log(`totalExpensesCaja:  $${totalExpensesCaja.toFixed(2)}`);
        console.log(`Net Caja:           $${netCaja.toFixed(2)}`);
    }
}
run();
