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

const headlessNotificationListener = async ({ notification }) => {
    if (!notification) return;

    try {
        const parsed = typeof notification === 'string' ? JSON.parse(notification) : notification;
        const { app, title, text } = parsed;
        
        const fullText = `${title || ''} ${text || ''}`.toLowerCase();
        
        // Verifica si es una acreditación de transferencia típica de Ualá
        if (fullText.includes('plata acreditada') && fullText.includes('transferencia')) {
            // Intenta extraer el nombre y el monto
            // Ejemplo de texto: "¡Plata acreditada! Recibiste una transferencia de Juan Perez $5000"
            // Captura grupo 1: Nombre (todo entre "de" y el símbolo "$")
            // Captura grupo 2: Monto (números, puntos y comas)
            const match = (text || '').match(/transferencia de (.*?)(?: por | \$|:\s*\$| \$\s*|\$)([\d.,]+)/i);
            
            if (match) {
                const senderName = match[1].trim();
                let amountStr = match[2].replace(/\./g, '').replace(',', '.');
                const amount = parseFloat(amountStr);
                
                if (!isNaN(amount) && amount > 0) {
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
                    
                    // Inicializar DB si no está inicializada y guardar
                    await LocalDbService.init();
                    await LocalDbService.saveItem('sales', saleObj);
                    
                    // También lo guardamos en pending_sync para que se sincronice con Supabase
                    await LocalDbService.queueForSync('sales', 'INSERT', saleObj);
                    console.log(`[UalaListener] ✅ Venta automática registrada: $${amount} de ${senderName}`);
                }
            }
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
