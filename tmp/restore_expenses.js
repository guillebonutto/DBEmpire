const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const olderExpenses = [
    {
        id: "7969ed7a-7643-46a9-84be-ab81e3852358",
        description: "Juego de termo con 3 tazas de acero inoxidable",
        amount: 9751,
        category: "Inventario",
        created_at: "2026-01-14T01:06:27.558888-03:00",
        discount: 0,
        product_id: "a75d4040-65ae-4942-8da5-193190b03099",
        color: null,
        quantity: null,
        details: [{"qty":1,"color":"Negro"}]
    },
    {
        id: "d3281927-eb32-4c23-9040-61236cb8afea",
        description: "Juego de termo con 3 tazas de acero inoxidable",
        amount: 162500,
        category: "Inventario",
        created_at: "2026-02-20T18:24:07.45-03:00",
        discount: 0,
        product_id: "a75d4040-65ae-4942-8da5-193190b03099",
        color: null,
        quantity: null,
        details: []
    },
    {
        id: "39f0e7c8-e1dd-430e-8081-06db16cfdc9b",
        description: "Juego de termo con 3 tazas de acero inoxidable",
        amount: 23292,
        category: "Inventario",
        created_at: "2025-12-13T20:00:00-03:00",
        discount: 0,
        product_id: null,
        color: null,
        quantity: null,
        details: [{"qty":3,"color":"Negro"}]
    }
];

async function restore() {
    console.log('Restoring legit older expenses...');
    for (const exp of olderExpenses) {
        const { error } = await supabase.from('expenses').insert(exp);
        if (error) console.error('Error restoring:', error);
        else console.log('Restored:', exp.description, exp.created_at);
    }
}
restore();
