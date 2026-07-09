const https = require('https');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

// Parser functions matching current UalaNotificationListener.js
const extractUalaPaymentData = (title, text) => {
    const combined = `${title || ''}\n${text || ''}`;

    // --- FORMATO B/C: "Recibiste $X.XXX,XX de Nombre" ---
    const matchFormatoB = combined.match(/recibiste\s+\$\s*([\d.,]+)\s+de\s+(.+)/i);
    if (matchFormatoB) {
        const rawAmount = matchFormatoB[1].replace(/\./g, '').replace(',', '.');
        const amount = parseFloat(rawAmount);
        const senderName = matchFormatoB[2].trim().split('\n')[0].trim();
        if (!isNaN(amount) && amount > 0) {
            return { amount, senderName };
        }
    }

    // --- FORMATO D (carga/depósito propio): "Ingresaste $X.XXX,XX a tu cuenta" ---
    const matchFormatoD = combined.match(/ingresaste\s+\$\s*([\d.,]+)/i);
    if (matchFormatoD) {
        const rawAmount = matchFormatoD[1].replace(/\./g, '').replace(',', '.');
        const amount = parseFloat(rawAmount);
        if (!isNaN(amount) && amount > 0) {
            return { amount, senderName: 'Depósito propio / Carga' };
        }
    }

    // --- FORMATO A (viejo): "transferencia de Nombre $monto" ---
    const matchFormatoA = combined.match(/transferencia de (.+?)\s+\$\s*([\d.,]+)/i);
    if (matchFormatoA) {
        const senderName = matchFormatoA[1].trim();
        const rawAmount = matchFormatoA[2].replace(/\./g, '').replace(',', '.');
        const amount = parseFloat(rawAmount);
        if (!isNaN(amount) && amount > 0) {
            return { amount, senderName };
        }
    }

    return null;
};

const isUalaPaymentNotification = (app, title, text) => {
    const t = (title || '').trim();
    const txt = (text || '').trim();
    if (!t && !txt) return false;

    const combined = `${t} ${txt}`.toLowerCase();
    const appId = (app || '').toLowerCase();
    const isUalaApp = appId.includes('uala') || appId.includes('ualá');

    const isOutgoing = (
        combined.includes('transferiste') ||
        combined.includes('enviaste') ||
        combined.includes('pago realizado') ||
        combined.includes('compra de') ||
        combined.includes('compra realizada')
    );
    if (isOutgoing) return false;

    const hasPaymentKeywords = (
        combined.includes('transferencia') ||
        combined.includes('recibiste') ||
        combined.includes('acreditad') ||
        combined.includes('ingresaste')
    ) && (
        combined.includes('$') || combined.includes('pesos')
    );

    return isUalaApp && hasPaymentKeywords;
};

const generateUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
});

// Mock notification
const mockNotification = {
    app: 'ar.com.bancar.uala',
    title: '¡Nueva transferencia!',
    text: 'Ingresaste $14.500,00 a tu cuenta'
};

async function simulate() {
    console.log("=== SIMULANDO LLEGADA DE NOTIFICACIÓN DE UALÁ ===");
    console.log("Payload de Notificación recibido por el Listener:");
    console.log(JSON.stringify(mockNotification, null, 2));

    const isUala = isUalaPaymentNotification(mockNotification.app, mockNotification.title, mockNotification.text);
    if (!isUala) {
        console.log("❌ La notificación fue ignorada por el filtro.");
        return;
    }

    const paymentData = extractUalaPaymentData(mockNotification.title, mockNotification.text);
    if (!paymentData) {
        console.log("❌ No se pudieron extraer los datos del pago.");
        return;
    }

    const { amount, senderName } = paymentData;
    console.log(`\n✅ Datos extraídos:`);
    console.log(`   - Monto: $${amount}`);
    console.log(`   - Remitente: ${senderName}`);

    // Create Sale Object
    const saleId = generateUUID();
    const saleObj = {
        id: saleId,
        total_amount: amount,
        profit_generated: amount,
        commission_amount: 0,
        client_id: null,
        seller_id: null,
        status: 'completed',
        created_at: new Date().toISOString(),
        notes: `Simulación: Cobro autodetectado Ualá de: ${senderName}`
    };

    console.log(`\n📤 Registrando venta en Supabase...`);
    console.log(`   Sale ID: ${saleId}`);

    const postData = JSON.stringify(saleObj);
    const options = {
        hostname: 'kxnqheckujcoytnfmxcd.supabase.co',
        path: '/rest/v1/sales',
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
    };

    const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
            console.log(`\nStatus Code: ${res.statusCode}`);
            try {
                const result = JSON.parse(responseData);
                console.log("Supabase Response:", JSON.stringify(result, null, 2));
                if (res.statusCode === 201 || res.statusCode === 200) {
                    console.log("\n🎉 ¡ÉXITO! La venta se registró y sincronizó correctamente en Supabase.");
                } else {
                    console.log("\n❌ Hubo un error al guardar en Supabase.");
                }
            } catch (e) {
                console.log("Raw Supabase Response:", responseData);
            }
        });
    });

    req.on('error', (e) => {
        console.error("Error en petición HTTP:", e.message);
    });

    req.write(postData);
    req.end();
}

simulate();
