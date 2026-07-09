const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function testUpdate() {
    const productToEditId = '87bcf160-49d1-476e-9931-8cae5d8fa0a2';
    
    // Simulate the exact productPayload from executeSave
    const productPayload = {
        description: '',
        provider: 'Gabriela Liliana Castelli (AliExpress)',
        cost_price: 5818.78,
        sale_price: 11637.56,
        sale_price_cordoba: 11637.56,
        profit_margin_percent: 0,
        internet_cost: 0,
        electricity_cost: 0,
        defect_notes: '',
        variants: [],
        active: true,
        image_url: null,
        is_individual: false,
        name: 'Adaptador soporte de carga tipo C',
        stock_local: 3,
        stock_cordoba: 0,
        current_stock: 3,
        barcode: null
    };

    console.log('Sending update request to Supabase for ID:', productToEditId);
    const { data, error } = await supabase
        .from('products')
        .update(productPayload)
        .eq('id', productToEditId)
        .select();

    if (error) {
        console.error('Update Error:', error);
    } else {
        console.log('Update Successful. Data returned:', data);
    }
}

testUpdate();
