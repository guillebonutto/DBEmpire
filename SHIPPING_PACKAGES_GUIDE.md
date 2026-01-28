# 📦 Sistema de Paquetes de Envío - Guía de Uso

## 🎯 Objetivo
Distribuir automáticamente los costos de transporte entre los productos que se envían juntos en un paquete, actualizando sus precios de costo para mantener el margen de ganancia.

## 🔄 Flujo de Trabajo

### 1. **Recibir Orden de Proveedor**
- Ve a **Panel de Control → Pedidos a Proveedores**
- Marca la orden como "Recibida" cuando llegue la mercadería
- Los productos ahora están disponibles para asignar a paquetes

### 2. **Crear Paquete de Envío**
- Ve a **Panel de Control → Paquetes de Envío** (ícono de paquete 📦)
- Toca el botón **+** en la esquina superior derecha
- Completa los datos:
  - **Nombre del Paquete**: Ej: "Envío Córdoba 28/01"
  - **Destino**: Córdoba, Buenos Aires, etc.
  - **Costo de Transporte Total**: El monto que te cobra el courier
  - **Empresa de Transporte**: Andreani, OCA, Via Cargo
  - **Número de Seguimiento**: (opcional)

### 3. **Seleccionar Productos**
- Toca **"Seleccionar Productos"**
- Marca todos los productos que van en ese paquete
- Solo aparecen productos de órdenes "Recibidas" que no estén en otro paquete

### 4. **Revisar Distribución Automática**
La app calcula automáticamente:
- **Proporción por costo**: Productos más caros absorben más costo de transporte
- **Costo por unidad**: Cuánto transporte le corresponde a cada producto
- **Nuevo precio de costo**: Costo original + transporte asignado

**Ejemplo:**
```
Paquete a Córdoba - Costo de transporte: $5,000

Producto A: 10 unidades × $100 = $1,000 (20% del total)
  → Transporte asignado: $1,000 (20% de $5,000)
  → Nuevo costo unitario: $100 + $100 = $200

Producto B: 5 unidades × $400 = $2,000 (40% del total)
  → Transporte asignado: $2,000 (40% de $5,000)
  → Nuevo costo unitario: $400 + $400 = $800

Producto C: 20 unidades × $100 = $2,000 (40% del total)
  → Transporte asignado: $2,000 (40% de $5,000)
  → Nuevo costo unitario: $100 + $100 = $200
```

### 5. **Confirmar y Aplicar**
- Revisa la distribución en la vista previa
- Toca **"CREAR PAQUETE Y DISTRIBUIR COSTOS"**
- La app automáticamente:
  - ✅ Crea el paquete
  - ✅ Asigna los productos al paquete
  - ✅ Actualiza el `cost_price` de cada producto
  - ✅ Recalcula el `selling_price` para mantener tu margen

### 6. **Seguimiento del Paquete**
- **Pendiente** → **En Tránsito** → **Entregado**
- Toca los botones de estado para actualizar
- Una vez entregado, el paquete queda registrado en el historial

## 💡 Ventajas del Sistema

### ✅ Precisión en Costos
- No más estimaciones: cada producto tiene su costo real de transporte
- Distribución proporcional justa

### ✅ Automatización
- No necesitas calcular manualmente
- Los precios se actualizan automáticamente

### ✅ Trazabilidad
- Historial completo de envíos
- Sabes exactamente qué productos fueron en cada paquete
- Tracking number para seguimiento

### ✅ Flexibilidad
- Puedes enviar productos de diferentes proveedores en el mismo paquete
- Funciona con productos nuevos (sin SKU) y existentes

## 📊 Reportes y Análisis

El sistema te permite:
- Ver cuánto gastaste en transporte por mes
- Identificar qué destinos son más costosos
- Analizar el impacto del transporte en tus márgenes

## ⚠️ Consideraciones Importantes

1. **Solo productos recibidos**: Solo puedes agregar productos de órdenes marcadas como "Recibidas"
2. **Un paquete por producto**: Cada producto solo puede estar en un paquete
3. **Actualización de precios**: El `cost_price` se actualiza permanentemente
4. **Margen de ganancia**: Asegúrate de que tu margen configurado sea suficiente para cubrir el transporte

## 🔧 Configuración Recomendada

Para que el sistema funcione óptimamente:
1. Marca las órdenes como "Recibidas" apenas lleguen
2. Crea el paquete de envío ANTES de enviar la mercadería
3. Actualiza el estado a "En Tránsito" cuando lo despachas
4. Marca como "Entregado" cuando tu socio confirme la recepción

## 📱 Acceso Rápido

**Panel de Control → Ícono de Paquete 📦**

---

¿Dudas? Revisa los ejemplos en la app o contacta soporte.
