
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const items = [
    { description: "Powerbank portátil 2 interfaces de salida (blanco)", amount: 19434.24, category: "Inventario" },
    { description: "Cable de carga rápida USB a tipo-C giratorio 180° rojo", amount: 49554.00, category: "Inventario" },
    { description: "Máquina de café portátil", amount: 16338.00, category: "Inventario" },
    { description: "Cable de carga rápida USB a tipo-C giratorio 180° (celeste agua)", amount: 49560.00, category: "Inventario" },
    { description: "Powerbank portátil 2 interfaces de salida (negro)", amount: 38868.00, category: "Inventario" },
    { description: "Powerbank portátil 2 interfaces de salida (rosa)", amount: 38868.00, category: "Inventario" }
];

const orderDate = "2026-01-16T03:45:40.749Z";

async function addExpenses() {
    console.log('Adding expenses...');
    const expensesToInsert = items.map(item => ({
        ...item,
        created_at: orderDate
    }));

    const { data, error } = await supabase
        .from('expenses')
        .insert(expensesToInsert);

    if (error) {
        console.error('Error adding expenses:', error);
    } else {
        console.log('Expenses added successfully!');
    }
}

addExpenses();
