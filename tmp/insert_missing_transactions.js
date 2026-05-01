const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
    'https://kxnqheckujcoytnfmxcd.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8'
);

async function main() {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // INGRESOS (tabla: sales)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const salesInserts = [
        {
            total_amount: 2600,
            profit_generated: 2600,
            commission_amount: 0,
            status: 'completed',
            created_at: '2026-01-13T12:00:00.000Z',
            device_sig: 'Manual',
            notes: 'Aporte de Nico para repartir gastos'
        },
        {
            total_amount: 10000,
            profit_generated: 400, // redondeó de 9600 a 10000
            commission_amount: 0,
            status: 'completed',
            created_at: '2026-02-09T12:00:00.000Z',
            device_sig: 'Manual',
            notes: 'Mariela Castelli - 3 tarjetas x $3200 (redondeó a $10.000)'
        },
        {
            total_amount: 32294.11,
            profit_generated: 0,
            commission_amount: 0,
            status: 'completed',
            created_at: '2026-02-14T12:00:00.000Z',
            device_sig: 'Manual',
            notes: 'Aporte propio para completar pago a Gabriela Castelli'
        },
        {
            total_amount: 34600,
            profit_generated: 0,
            commission_amount: 0,
            status: 'completed',
            created_at: '2026-02-23T12:00:00.000Z',
            device_sig: 'Manual',
            notes: 'Ingreso agrupado de varias ventas del día'
        }
    ];

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // EGRESOS (tabla: expenses)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const expensesInserts = [
        {
            amount: 27152,
            category: 'Pago de Deuda',
            description: 'Fondos externos usados para pagar cuota',
            created_at: '2026-02-14T13:00:00.000Z'
        }
    ];

    console.log('Insertando ventas/ingresos...');
    const { data: sData, error: sError } = await sb.from('sales').insert(salesInserts).select();
    if (sError) {
        console.error('❌ Error en ventas:', sError.message);
    } else {
        console.log(`✅ ${sData.length} ingresos insertados`);
    }

    console.log('\nInsertando gastos...');
    const { data: eData, error: eError } = await sb.from('expenses').insert(expensesInserts).select();
    if (eError) {
        console.error('❌ Error en gastos:', eError.message);
    } else {
        console.log(`✅ ${eData.length} gastos insertados`);
    }
}

main().catch(console.error);
