# 💎 DigitalBoost Empire - Sistema de Diseño Premium

Este documento define la identidad visual y los estándares de interfaz de usuario para la aplicación DigitalBoost Empire. Mantener estos estándares asegura una experiencia de usuario coherente, lujosa y profesional.

## 🎨 Paleta de Colores

### Colores Base
*   **Fondo Principal (Deep Black):** `#000000`
    *   *Uso:* Fondo de pantallas completas y modales.
*   **Superficie Primaria (Obsidian):** `#111111`
    *   *Uso:* Tarjetas, filas de lista y contenedores secundarios.
*   **Superficie Secundaria (Graphite):** `#222222`
    *   *Uso:* Bordes, fondos de botones secundarios y controles de cantidad.

### Colores de Acento
*   **Oro Empire (Primary Gold):** `#d4af37`
    *   *Uso:* Títulos destacados, elementos seleccionados, botones de acción principal (CTA) e íconos críticos.
*   **Oro Suave (Subtle Gold):** `#b8962e`
    *   *Uso:* Estados activos menos prominentes.

### Tipografía y Texto
*   **Texto Principal (Pure White):** `#FFFFFF` (100% opacidad)
*   **Texto Secundario (Silver):** `#888888`
    *   *Uso:* Subtítulos, etiquetas (labels) y metadatos.
*   **Texto Deshabilitado/Placeholder:** `#666666`

### Estados y Alertas
*   **Peligro / Sin Stock:** `#e74c3c` (Vibrant Red)
*   **Éxito:** `#2ecc71` (Emerald Green)

---

## 🏗️ Estructura y Layout

### 1. Pantallas (Screens)
*   **Padding General:** `20px` en todos los bordes.
*   **Separación entre elementos:** Mínimo `10px` a `15px`.
*   **Bordes Redondeados (Border Radius):**
    *   Botones y Tarjetas: `12px`
    *   Controles pequeños (Pills): `20px`

### 2. Navegación
*   **Barra Superior (Header):** Título en `Oro Empire` con íconos funcionales en blanco o gris.
*   **Tabs:** Íconos minimalistas. El tab activo debe resaltar en `Oro Empire`.

---

## 💠 Componentes Estandarizados

### Botones
| Tipo | Fondo | Texto | Bordes |
| :--- | :--- | :--- | :--- |
| **Principal** | `#d4af37` | `#000000` (Bold) | `12px` radius |
| **Secundario** | `#333333` | `#FFFFFF` | `12px` radius |
| **Pill (Filtro)** | `#222222` | `#FFFFFF` | `20px` radius |

### Tarjetas de Producto / Lista
*   Fondo: `#111111`
*   Borde: `1px solid #222222`
*   Estado Expandido: Borde de `2px solid #d4af37` para indicar foco.

---

## ✨ Micro-interacciones y Efectos
*   **Feedback Táctil:** Uso de `TouchableOpacity` con opacidad suave para botones.
*   **Transiciones:** Animaciones tipo "Slide" para modales y cambios de pantalla suaves.
*   **Glassmorphism (Opcional):** Uso de desenfoque (blur) en headers o elementos flotantes si el sistema lo permite.

---

## 📱 Guía de Iconografía
*   **Librería:** `MaterialCommunityIcons` (Expo).
*   **Tamaño estándar:** `24px` para navegación, `20px` para búsquedas e interiores.
*   **Color por defecto:** `#888888` (Inactivo) / `#d4af37` (Activo).

---

> [!TIP]
> **Consistencia es Clave:** Si un componente no está en esta guía, intenta derivarlo de los colores y bordes definidos aquí. Evita introducir nuevos colores fuera de la gama de negros, grises y dorados.
