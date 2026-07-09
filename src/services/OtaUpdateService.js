/**
 * OtaUpdateService.js
 * Servicio para verificar y aplicar actualizaciones Over-the-Air (OTA)
 * utilizando expo-updates y el sistema de alertas de Digital Boost Empire.
 */

import * as Updates from 'expo-updates';
import { alertManager } from '../hooks/useAlert';

export const OtaUpdateService = {
    /**
     * Realiza un chequeo silencioso al iniciar la aplicación.
     * Si encuentra una actualización, le avisa al usuario para descargarla.
     */
    async runAutoCheck() {
        if (__DEV__) {
            console.log('[-] OTA updates check bypassed in DEV mode.');
            return;
        }

        try {
            const update = await Updates.checkForUpdateAsync();
            if (update.isAvailable) {
                alertManager.show({
                    type: 'info',
                    title: 'Actualización Disponible',
                    message: 'Hay una nueva versión de la aplicación disponible. ¿Deseas descargarla e instalarla ahora?',
                    buttons: [
                        { text: 'Más Tarde', style: 'cancel' },
                        { 
                            text: 'Actualizar', 
                            style: 'confirm',
                            onPress: () => this.applyUpdate()
                        }
                    ]
                });
            }
        } catch (error) {
            console.log('[-] Silent OTA update check failed:', error);
        }
    },

    /**
     * Realiza una búsqueda manual de actualizaciones solicitada por el usuario.
     * Muestra indicadores de carga y mensajes de éxito/error en la UI.
     */
    async checkAndPromptManual() {
        alertManager.show({
            type: 'info',
            title: 'Buscando Actualizaciones',
            message: 'Conectando con el servidor de actualizaciones de Digital Boost Empire...',
            buttons: [] // Sin botones para que actúe como indicador de carga
        });

        // Breve retraso para asegurar que la animación del alert se muestre fluida
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (__DEV__) {
            alertManager.show({
                type: 'info',
                title: 'Modo Desarrollo',
                message: 'Estás ejecutando la aplicación en modo desarrollo. Las actualizaciones OTA no están activas en este entorno.',
                buttons: [{ text: 'Entendido' }]
            });
            return;
        }

        try {
            const update = await Updates.checkForUpdateAsync();
            if (update.isAvailable) {
                alertManager.show({
                    type: 'info',
                    title: '¡Actualización Encontrada!',
                    message: 'Hay una nueva versión disponible. ¿Deseas descargarla e instalarla ahora?',
                    buttons: [
                        { text: 'Cancelar', style: 'cancel' },
                        { 
                            text: 'Actualizar', 
                            style: 'confirm',
                            onPress: () => this.applyUpdate()
                        }
                    ]
                });
            } else {
                alertManager.show({
                    type: 'success',
                    title: 'Sistema al Día',
                    message: '¡Excelente! Ya tienes instalada la versión más reciente de Digital Boost Empire.',
                    buttons: [{ text: 'Entendido' }]
                });
            }
        } catch (error) {
            console.error('[-] Error checking manual OTA update:', error);
            alertManager.show({
                type: 'error',
                title: 'Error de Chequeo',
                message: 'No se pudo conectar con el servidor de actualizaciones. Por favor, verifica tu conexión e inténtalo de nuevo.',
                buttons: [{ text: 'Aceptar' }]
            });
        }
    },

    /**
     * Descarga la actualización de forma segura y notifica al finalizar.
     */
    async applyUpdate() {
        alertManager.show({
            type: 'info',
            title: 'Descargando',
            message: 'Descargando e instalando la actualización... Por favor, no cierres la aplicación.',
            buttons: [] // Bloquea interacción durante la descarga
        });

        try {
            await Updates.fetchUpdateAsync();
            
            // Éxito en la descarga, solicitamos el reinicio obligatorio para aplicar
            alertManager.show({
                type: 'success',
                title: '¡Descarga Exitosa!',
                message: 'La actualización se aplicó correctamente. La aplicación debe reiniciarse para activar los cambios.',
                buttons: [
                    {
                        text: 'Reiniciar Ahora',
                        style: 'confirm',
                        onPress: async () => {
                            try {
                                await Updates.reloadAsync();
                            } catch (err) {
                                console.error('[-] Failed to reload app:', err);
                            }
                        }
                    }
                ]
            });
        } catch (error) {
            console.error('[-] Error downloading OTA update:', error);
            alertManager.show({
                type: 'error',
                title: 'Fallo de Instalación',
                message: 'Ocurrió un error al descargar la actualización. Inténtalo de nuevo más tarde.',
                buttons: [{ text: 'Aceptar' }]
            });
        }
    }
};
