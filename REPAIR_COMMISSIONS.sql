-- Reparar comisiones faltantes del mes actual
-- Este script calcula la comisión para todas las ventas que quedaron en $0 
-- basándose en la ganancia generada y el porcentaje configurado en tus ajustes.

UPDATE public.sales 
SET commission_amount = profit_generated * (
    SELECT COALESCE(CAST(value AS FLOAT), 0.10) 
    FROM public.settings 
    WHERE key = 'commission_rate'
)
WHERE (commission_amount = 0 OR commission_amount IS NULL)
AND created_at >= date_trunc('month', now());

-- Comentario: Una vez ejecutes esto, los Aliados verán sus montos acumulados correctamente.
