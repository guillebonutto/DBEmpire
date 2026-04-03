const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    'https://kxnqheckujcoytnfmxcd.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8'
);

async function restoreAlly() {
    // First check current state
    const { data: current, error: readErr } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('full_name', 'Vendedor (Primo)')
        .single();

    if (readErr) {
        console.error('Error reading profile:', readErr.message);
        return;
    }

    console.log('Current state:', current);

    if (current.role === 'seller') {
        console.log('✅ Already has seller role — no change needed.');
        return;
    }

    // Restore to seller
    const { data, error } = await supabase
        .from('profiles')
        .update({ role: 'seller' })
        .eq('full_name', 'Vendedor (Primo)')
        .select()
        .single();

    if (error) {
        console.error('❌ Error restoring role:', error.message);
    } else {
        console.log('✅ Role restored successfully:', data.full_name, '→', data.role);
    }
}

restoreAlly();
