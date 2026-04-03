const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function createCordobaPriceColumn() {
    // Nota: Como no puedo correr SQL directo desde acá de forma fácil,
    // voy a intentar "forzar" la existencia para probar si ya está (solo por si acaso).
    const { data, error } = await supabase.from('products').select('sale_price_cordoba').limit(1);

    if (error && error.message.includes('column "sale_price_cordoba" does not exist')) {
        console.log('Falta la columna sale_price_cordoba. La vamos a necesitar crear en el panel de Supabase o mediante un script de mantenimiento.');
    } else {
        console.log('✅ ¡Excelente noticia! La columna sale_price_cordoba ya existe o no disparó error.');
    }
}

createCordobaPriceColumn();
