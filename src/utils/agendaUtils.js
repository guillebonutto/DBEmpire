// Design Tokens and Categories for Imperial Agenda
export const CATEGORIES = [
    {
        id: 'educativo',
        label: 'Educativo',
        color: '#ff3b30', // Rojo
        bgColor: 'rgba(255, 59, 48, 0.18)',
        icon: 'school-outline',
        defaultStage: 'Guión en proceso',
    },
    {
        id: 'entretenimiento',
        label: 'Entretenimiento',
        color: '#ff9500', // Naranja
        bgColor: 'rgba(255, 149, 0, 0.18)',
        icon: 'emoticon-happy-outline',
        defaultStage: 'Idea aprobada',
    },
    {
        id: 'informativo',
        label: 'Informativo / Autoridad',
        color: '#34c759', // Verde
        bgColor: 'rgba(52, 199, 89, 0.18)',
        icon: 'newspaper-variant-outline',
        defaultStage: 'Recopilando datos',
    },
    {
        id: 'bts',
        label: 'Detrás de escena (BTS)',
        color: '#007aff', // Azul
        bgColor: 'rgba(0, 122, 255, 0.18)',
        icon: 'video-vintage',
        defaultStage: 'Listo para grabar',
    },
    {
        id: 'promocional',
        label: 'Promocional / Venta',
        color: '#ff2d55', // Fucsia
        bgColor: 'rgba(255, 45, 85, 0.18)',
        icon: 'tag-outline',
        defaultStage: 'Estrategia definida',
    },
    {
        id: 'inspiracional',
        label: 'Inspiracional',
        color: '#af52de', // Morado
        bgColor: 'rgba(175, 82, 222, 0.18)',
        icon: 'lightbulb-on-outline',
        defaultStage: 'Redactando copy',
    },
];

export const DEFAULT_STAGES = [
    'Idea inicial',
    'Guión aprobado • Listo para render',
    'En postproducción • Miniatura lista',
    'Listo para publicar',
    'Recordatorio general',
];

/**
 * Parses reminder note metadata (category, stage, custom text).
 */
export function parseReminderMeta(reminder) {
    let category = 'educativo';
    let stage = 'Guión en proceso';
    let customText = reminder.notes || '';

    if (reminder.notes && typeof reminder.notes === 'string') {
        const trimmed = reminder.notes.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
                const parsed = JSON.parse(trimmed);
                category = parsed.category || category;
                stage = parsed.stage || stage;
                customText = parsed.text || '';
            } catch (_) {}
        }
    }
    return { category, stage, customText };
}

/**
 * Builds the 7-column calendar grid for a given year & month (Monday start).
 */
export function generateMonthGrid(year, month) {
    const firstDayOfMonth = new Date(year, month, 1);
    let startDay = firstDayOfMonth.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells = [];

    // Previous month overflow
    for (let i = startDay - 1; i >= 0; i--) {
        const dayNum = daysInPrevMonth - i;
        const cellDate = new Date(year, month - 1, dayNum);
        const dateKey = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        cells.push({
            day: dayNum,
            date: cellDate,
            dateKey,
            isCurrentMonth: false,
        });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        const cellDate = new Date(year, month, dayNum);
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        cells.push({
            day: dayNum,
            date: cellDate,
            dateKey,
            isCurrentMonth: true,
        });
    }

    // Next month overflow
    const totalRows = Math.ceil(cells.length / 7);
    const targetTotal = Math.max(totalRows * 7, 35);
    const remaining = targetTotal - cells.length;
    for (let dayNum = 1; dayNum <= remaining; dayNum++) {
        const cellDate = new Date(year, month + 1, dayNum);
        const dateKey = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        cells.push({
            day: dayNum,
            date: cellDate,
            dateKey,
            isCurrentMonth: false,
        });
    }

    return cells;
}
