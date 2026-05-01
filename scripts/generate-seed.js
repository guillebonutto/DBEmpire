const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Real credentials
const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

async function generateSeed() {
    console.log('帝国 [EMPIRE] - Iniciando descarga masiva para OFFLINE TOTAL...');
    try {
        const [
            { data: products },
            { data: clients },
            { data: settings },
            { data: sales },
            { data: expenses },
            { data: authorized_devices },
            { data: supplier_orders },
            { data: sale_items },
            { data: supplier_order_items }
        ] = await Promise.all([
            supabase.from('products').select('*').order('name'),
            supabase.from('clients').select('*').order('name'),
            supabase.from('settings').select('*'),
            supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(500),
            supabase.from('expenses').select('*').order('created_at', { ascending: false }).limit(500),
            supabase.from('authorized_devices').select('*'),
            supabase.from('supplier_orders').select('*').order('created_at', { ascending: false }),
            supabase.from('sale_items').select('*').limit(1000),
            supabase.from('supplier_order_items').select('*')
        ]);

        // --- Descarga de Imágenes ---
        console.log('🖼️ Descargando imágenes de productos...');
        const imgDir = path.join(__dirname, '..', 'assets', 'products');
        if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

        const mapping = {};
        for (const p of (products || [])) {
            if (p.image_url && p.image_url.startsWith('http')) {
                const ext = path.extname(p.image_url.split('?')[0]) || '.jpg';
                const filename = `${p.id}${ext}`;
                const dest = path.join(imgDir, filename);
                
                try {
                    if (!fs.existsSync(dest)) {
                        await downloadFile(p.image_url, dest);
                        process.stdout.write('.');
                    }
                    mapping[p.id] = filename;
                } catch (e) {
                    // silent fail for individual images
                }
            }
        }
        console.log('\n✅ Imágenes descargadas.');

        // --- Generar JS de Mapeo ---
        const mappingJS = `// AUTO-GENERATED FILE. DO NOT EDIT.
export const ImageMapping = {
${Object.entries(mapping).map(([id, file]) => `  "${id}": require("../../assets/products/${file}"),`).join('\n')}
};
`;
        fs.writeFileSync(path.join(__dirname, '..', 'src', 'assets', 'image_mapping.js'), mappingJS);

        const SEED_VERSION = Date.now();
        const seedData = {
            __version: SEED_VERSION,
            products: products || [],
            clients: clients || [],
            settings: (settings || []).map(s => {
                if (s.key.includes('api_key') || s.key.includes('token')) {
                    return { ...s, value: 'REMOVED_FOR_SECURITY' };
                }
                return s;
            }),
            sales: sales || [],
            expenses: expenses || [],
            authorized_devices: authorized_devices || [],
            supplier_orders: supplier_orders || [],
            sale_items: sale_items || [],
            supplier_order_items: supplier_order_items || []
        };

        const targetPath = path.join(__dirname, '..', 'assets', 'seed_data.json');
        fs.writeFileSync(targetPath, JSON.stringify(seedData, null, 2));
        
        console.log(`✅ ¡SEMILLA GENERADA! v${SEED_VERSION}`);
        console.log(`📈 Se incluyeron ${seedData.supplier_order_items.length} items de proveedores.`);
    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

generateSeed();
