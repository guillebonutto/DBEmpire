const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function createSocioCordoba() {
    // 1. Verificamos si ya existe
    const { data: existing } = await supabase.from('clients').select('id').eq('name', 'Socio Córdoba').single();
    
    if (existing) {
        console.log('✅ El contacto Socio Córdoba ya existe. ID:', existing.id);
        return;
    }

    // 2. Si no, lo creamos
    const { data, error } = await supabase
        .from('clients')
        .insert([{ name: 'Socio Córdoba', phone: 'SUCURSAL-01', status: 'active' }])
        .select()
        .single();

    if (error) console.error('Error al crear contacto logístico:', error);
    else console.log('✅ Contacto "Socio Córdoba" creado para rastrear envíos internos.');
}

createSocioCordoba();
