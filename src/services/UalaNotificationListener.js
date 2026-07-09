import { AppRegistry, Platform, Alert } from 'react-native';
import RNAndroidNotificationListener from 'react-native-android-notification-listener';
import { LocalDbService } from './localDbService';

export const checkUalaListenerPermission = async () => {
    if (Platform.OS !== 'android') return;

    try {
        const status = await RNAndroidNotificationListener.getPermissionStatus();
        if (status !== 'authorized') {
            Alert.alert(
                "Permiso Requerido",
                "Para automatizar los cobros de Ualá, la app necesita permiso para leer notificaciones. Te llevaremos a los ajustes.",
                [
                    { text: "Cancelar", style: "cancel" },
                    { text: "Abrir Ajustes", onPress: () => RNAndroidNotificationListener.requestPermission() }
                ]
            );
        }
    } catch (error) {
        console.warn("[UalaListener] Error checking permission:", error);
    }
};

/**
 * Extrae monto y nombre del remitente de una notificación de Ualá.
 * Soporta múltiples formatos detectados:
 *
 * Formato A (viejo): "¡Plata acreditada! Recibiste una transferencia de Juan Perez $5.000"
 * Formato B (actual): "Nueva transferencia!\nRecibiste $8.000,00 de Nancy Edith Garcia Molina"
 * Formato C (alternativo): "Recibiste $8.000,00 de Nancy Edith"
 * Formato D (carga propia): "Ingresaste $14.500,00 a tu cuenta"
 */
const extractUalaPaymentData = (title, text) => {
    const combined = `${title || ''}\n${text || ''}`;

    // --- FORMATO B/C (actual de Ualá): "Recibiste $X.XXX,XX de Nombre Apellido" ---
    // El monto usa punto como separador de miles y coma como decimal
    const matchFormatoB = combined.match(/recibiste\s+\$\s*([\d.,]+)\s+de\s+(.+)/i);
    if (matchFormatoB) {
        // Normaliza el monto argentino: "8.000,00" → 8000.00
        const rawAmount = matchFormatoB[1].replace(/\./g, '').replace(',', '.');
        const amount = parseFloat(rawAmount);
        const senderName = matchFormatoB[2].trim().split('\n')[0].trim(); // solo primera línea
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

/**
 * Verifica si la notificación proviene de Ualá y es un ingreso de dinero relevante.
 */
const isUalaPaymentNotification = (app, title, text) => {
    const t = (title || '').trim();
    const txt = (text || '').trim();
    
    // Ignorar notificaciones vacías
    if (!t && !txt) {
        return false;
    }

    const combined = `${t} ${txt}`.toLowerCase();
    const appId = (app || '').toLowerCase();

    // Match por nombre de la app Ualá
    const isUalaApp = appId.includes('uala') || appId.includes('ualá');

    // Ignorar transferencias salientes (egresos), compras o pagos realizados
    const isOutgoing = (
        combined.includes('transferiste') ||
        combined.includes('enviaste') ||
        combined.includes('pago realizado') ||
        combined.includes('compra de') ||
        combined.includes('compra realizada')
    );
    if (isOutgoing) {
        return false;
    }

    // Match por contenido del mensaje para ingresos
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

const headlessNotificationListener = async ({ notification }) => {
    if (!notification) return;

    try {
        const parsed = typeof notification === 'string' ? JSON.parse(notification) : notification;
        const { app, title, text } = parsed;

        if (!isUalaPaymentNotification(app, title, text)) {
            return; // No es una notificación de pago, ignorar
        }

        const paymentData = extractUalaPaymentData(title, text);

        if (paymentData) {
            const { amount, senderName } = paymentData;
            const saleId = `sale_uala_${Date.now()}`;
            const saleObj = {
                id: saleId,
                total_amount: amount,
                profit_generated: amount,
                commission_amount: 0,
                client_id: null,
                seller_id: null,
                payment_method: 'transferencia',
                status: 'completed',
                created_at: new Date().toISOString(),
                notes: `Cobro autodetectado Ualá de: ${senderName}`
            };

            // Usamos SyncService para guardar localmente y subir inmediatamente a Supabase en segundo plano
            const { SyncService } = require('./syncService');
            await SyncService.queueAction('sale', saleObj, { items: [] });
            console.log(`[UalaListener] ✅ Venta automática registrada y sincronizada en background: $${amount} de ${senderName}`);
        } else {
            console.warn(`[UalaListener] ⚠️ Notificación de Ualá detectada pero no se pudo extraer el monto. Title: "${title}", Text: "${text}"`);
        }

    } catch (error) {
        console.error('[UalaListener] Error procesando notificación:', error);
    }
};

export const registerUalaHeadlessTask = () => {
    if (Platform.OS === 'android') {
        AppRegistry.registerHeadlessTask('RNAndroidNotificationListenerHeadlessJs', () => headlessNotificationListener);
    }
};
