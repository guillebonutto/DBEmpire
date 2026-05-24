/**
 * useAlert.js
 * Hook para manejo global de alertas imperativas
 * 
 * Permite mostrar alertas desde cualquier parte de la app
 * sin necesidad de pasar props o contextos
 * 
 * Digital Boost Empire - Alert System
 */

import { useState, useCallback, useEffect } from 'react';

/**
 * Manager global singleton para permitir llamadas imperativas
 * Esto permite usar alertManager.show() desde cualquier archivo
 */
class AlertManager {
    constructor() {
        this.showCallback = null;
        this.hideCallback = null;
    }

    setShowCallback(callback) {
        this.showCallback = callback;
    }

    setHideCallback(callback) {
        this.hideCallback = callback;
    }

    show(config) {
        if (this.showCallback) {
            this.showCallback(config);
        } else {
            console.warn('⚠️ AlertManager: showCallback not initialized. Did you forget to add <CustomAlert> in App.js?');
        }
    }

    hide() {
        if (this.hideCallback) {
            this.hideCallback();
        } else {
            console.warn('⚠️ AlertManager: hideCallback not initialized.');
        }
    }
}

// Instancia global exportada
export const alertManager = new AlertManager();

/**
 * Hook principal para manejo de alertas
 * Debe usarse en el componente raíz (App.js)
 */
export const useAlert = () => {
    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        type: 'info',
        title: '',
        message: '',
        buttons: []
    });

    /**
     * Muestra un alert con la configuración especificada
     */
    const showAlert = useCallback((config) => {
        setAlertConfig({
            visible: true,
            type: config.type || 'info',
            title: config.title || '',
            message: config.message || '',
            buttons: config.buttons || [{ text: 'OK', onPress: () => { } }]
        });
    }, []);

    /**
     * Oculta el alert actual
     */
    const hideAlert = useCallback(() => {
        setAlertConfig(prev => ({
            ...prev,
            visible: false
        }));

        // Reset completo después de la animación
        setTimeout(() => {
            setAlertConfig({
                visible: false,
                type: 'info',
                title: '',
                message: '',
                buttons: []
            });
        }, 300);
    }, []);

    /**
     * Registrar callbacks en el manager global
     * Solo se ejecuta una vez al montar
     */
    useEffect(() => {
        alertManager.setShowCallback(showAlert);
        alertManager.setHideCallback(hideAlert);

        return () => {
            // Cleanup al desmontar
            alertManager.setShowCallback(null);
            alertManager.setHideCallback(null);
        };
    }, [showAlert, hideAlert]);

    return {
        alertProps: {
            ...alertConfig,
            onClose: hideAlert
        },
        showAlert,
        hideAlert
    };
};

/**
 * Métodos de conveniencia exportados
 */
export const showSuccess = (title, message, buttons = []) => {
    alertManager.show({ type: 'success', title, message, buttons });
};

export const showError = (title, message, buttons = []) => {
    alertManager.show({ type: 'error', title, message, buttons });
};

export const showWarning = (title, message, buttons = []) => {
    alertManager.show({ type: 'warning', title, message, buttons });
};

export const showInfo = (title, message, buttons = []) => {
    alertManager.show({ type: 'info', title, message, buttons });
};

export const showSandbox = (title, message, buttons = []) => {
    alertManager.show({ type: 'sandbox', title, message, buttons });
};