/**
 * useAlert.js
 *
 * Hook para reemplazar Alert.alert() nativo con CustomAlert branded.
 *
 * Uso:
 *   const { showAlert, alertProps } = useAlert();
 *
 *   // En el JSX del componente:
 *   <CustomAlert {...alertProps} />
 *
 *   // Para mostrar:
 *   showAlert({
 *       type: 'success',          // 'success' | 'error' | 'warning' | 'info' | 'sandbox' | 'confirm'
 *       title: 'Operación OK',
 *       message: 'Total: $15000',
 *       buttons: [
 *           { text: 'CERRAR',  style: 'cancel',  onPress: () => {} },
 *           { text: 'VER PDF', onPress: () => {} },
 *       ],
 *       dismissable: false,   // optional — close on backdrop tap
 *   });
 */

import { useState, useCallback, useRef } from 'react';

export function useAlert() {
    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        type: 'info',
        title: '',
        message: '',
        buttons: [],
        dismissable: false,
    });

    // Resolve type from title/message heuristics if type is omitted
    const resolveType = (cfg) => {
        if (cfg.type) return cfg.type;
        const t = ((cfg.title || '') + (cfg.message || '')).toLowerCase();
        if (t.includes('error') || t.includes('fallo') || t.includes('no se pudo')) return 'error';
        if (t.includes('sandbox') || t.includes('🧪')) return 'sandbox';
        if (t.includes('✅') || t.includes('registrad') || t.includes('éxito') || t.includes('ok')) return 'success';
        if (t.includes('⚠') || t.includes('atención') || t.includes('sin stock')) return 'warning';
        return 'info';
    };

    const showAlert = useCallback((cfg) => {
        // Strip emoji prefixes from title that were used with native Alert
        let title = cfg.title || '';
        title = title.replace(/^(✅|⚠️|🧪|❌|ℹ️)\s*/, '');

        setAlertConfig({
            visible: true,
            type: resolveType(cfg),
            title,
            message: cfg.message || '',
            buttons: cfg.buttons || [{ text: 'OK', onPress: null }],
            dismissable: cfg.dismissable ?? false,
            onDismiss: () => setAlertConfig(prev => ({ ...prev, visible: false })),
        });
    }, []);

    const hideAlert = useCallback(() => {
        setAlertConfig(prev => ({ ...prev, visible: false }));
    }, []);

    // alertProps — spread directly into <CustomAlert {...alertProps} />
    const alertProps = {
        ...alertConfig,
        onDismiss: () => setAlertConfig(prev => ({ ...prev, visible: false })),
    };

    return { showAlert, hideAlert, alertProps };
}
