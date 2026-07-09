const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function calculateLedger() {
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

    const cajaExpenses = (expenses || []).filter(e => {
        const isExcluded = isInitialCreditStock(e); // yield and debt payment are included in caja flow
        return !isExcluded;
    });

    // Combine sales and expenses into a single ledger
    const ledger = [];

    completedSales.forEach(s => {
        ledger.push({
            type: 'INGRESO (VENTA)',
            date: new Date(s.paid_at || s.created_at),
            amount: parseFloat(s.total_amount) || 0,
            desc: `Venta ID: ${s.id.slice(0, 8)} | Cliente: ${s.client_id || 'Manual'}`
        });
    });

    cajaExpenses.forEach(e => {
        const val = parseFloat(e.amount) || 0;
        let type = 'EGRESO (GASTO)';
        let finalAmt = -val;
        if (isBankYield(e)) {
            type = 'INGRESO (RENDIMIENTO BANCARIO)';
            finalAmt = val; // yield is stored as negative or positive? Let's check: it was stored as negative.
        } else if (isDebtPayment(e)) {
            type = 'EGRESO (PAGO DE DEUDA)';
        }

        ledger.push({
            type,
            date: new Date(e.created_at),
            amount: finalAmt,
            desc: `${e.category}: ${e.description}`
        });
    });

    // Sort chronologically
    ledger.sort((a,b) => a.date - b.date);

    console.log("--- CHRONOLOGICAL CASH FLOW LEDGER ---");
    let balance = 0;
    ledger.forEach((item, index) => {
        balance += item.amount;
        console.log(`${index + 1}. [${item.date.toISOString().slice(0,16)}] ${item.type} | Amount: $${item.amount > 0 ? '+' : ''}${item.amount.toFixed(2)} | Balance: $${balance.toFixed(2)} | Details: ${item.desc}`);
    });

    console.log(`\nFinal Safe Box (Caja Fuerte) Liquidity Balance: $${balance.toFixed(2)}`);
}

calculateLedger();
