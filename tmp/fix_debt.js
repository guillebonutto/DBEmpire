const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    'https://kxnqheckujcoytnfmxcd.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8'
);

(async () => {
    // Buscar la última orden de Alejandro Castelli
    const { data: client } = await supabase
        .from('clients')
        .select('id')
        .ilike('name', '%Alejandro%')
        .single();

    if (!client) { console.error('No se encontró Alejandro'); return; }

    // Traer su última orden
    const { data: sales } = await supabase
        .from('sales')
        .select('id, status, created_at')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(1);

    if (!sales || sales.length === 0) { console.error('No se encontraron órdenes'); return; }

    const lastSale = sales[0];
    console.log('📦 Orden a revertir:', lastSale.id.slice(0,8));
    console.log('📅 Fecha:', lastSale.created_at);
    console.log('🔄 Estado actual:', lastSale.status, '→ budget');

    // Revertir a budget (presupuesto pendiente de pago)
    const { error } = await supabase
        .from('sales')
        .update({ status: 'budget' })
        .eq('id', lastSale.id);

    if (error) { console.error('Error:', error.message); return; }
    console.log('✅ Orden revertida a PRESUPUESTO correctamente.');
})();
