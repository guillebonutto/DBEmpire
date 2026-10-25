import { supabase } from './supabase';
import { useFinanceStore } from '../store/useFinanceStore';
import { useProductStore } from '../store/useProductStore';
import { useReminderStore } from '../store/useReminderStore';

let cachedResponse = null;
let lastFetchTime = null;
let cachedResponseRole = null;
const FALLBACK_GOOGLE_KEY = 'AIzaSyB4q6ThzvW0DdrkgF14PC0QKKyaDirkyVs';
let cachedApiKey = null;

const getGoogleApiKey = async () => {
    if (cachedApiKey) return cachedApiKey;
    try {
        const { data: settingsData, error } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'google_api_key')
            .single();
        if (!error && settingsData?.value) {
            cachedApiKey = settingsData.value;
            return cachedApiKey;
        }
    } catch (e) {
        console.warn("[EmpireAIService] Error fetching google_api_key from Supabase:", e);
    }
    return FALLBACK_GOOGLE_KEY;
};

export const EmpireAIService = {
    // -------------------------------------------------------------
    // LOGGING AND TRACKING
    // -------------------------------------------------------------
    logAIActions: async (missions, contextSnapshot) => {
        if (!missions || missions.length === 0) return;
        
        try {
            const logs = missions.map(m => ({
                action_type: m.type || m.action_type || 'generic',
                title: m.title || m.action || 'Acción sugerida',
                reason: m.reason || m.goal || '',
                target_id: m.target_id || '',
                context_snapshot: contextSnapshot,
                executed: false,
                confidence_score: m.confidence || 0.8
            }));

            const { error } = await supabase.from('ai_action_logs').insert(logs);
            if (error) console.error("Error logging AI actions:", error);
        } catch (e) {
            console.error("AI Logging Failed:", e);
        }
    },

    evaluatePendingActions: async () => {
        try {
            const { data: pending } = await supabase
                .from('ai_action_logs')
                .select('*')
                .eq('executed', false)
                .limit(5);

            if (!pending || pending.length === 0) return;

            const financeState = useFinanceStore.getState();
            const recentSales = financeState.sales || [];

            for (const log of pending) {
                const actionTime = new Date(log.created_at);
                const salesAfterAction = recentSales.filter(s => new Date(s.created_at) > actionTime);
                
                if (salesAfterAction.length > 0) {
                    const revDelta = salesAfterAction.reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0);
                    const profDelta = salesAfterAction.reduce((sum, s) => sum + (parseFloat(s.profit_generated) || 0), 0);

                    await supabase
                        .from('ai_action_logs')
                        .update({
                            executed: true,
                            revenue_delta: revDelta,
                            profit_delta: profDelta,
                            execution_date: new Date().toISOString()
                        })
                        .eq('id', log.id);
                }
            }
        } catch (e) {
            console.log("Evaluation error:", e);
        }
    },

    // -------------------------------------------------------------
    // GENERATION ENGINE
    // -------------------------------------------------------------
    suggestContent: async (category) => {
        try {
            const apiKey = await getGoogleApiKey();
            if (!apiKey) throw new Error("API Key missing.");

            const prompt = `Eres el Coach de Estrategia de Digital Boost Empire.
Necesito una idea RÁPIDA y MAGNÉTICA para un contenido de categoría "${category}".
Devuelve ÚNICAMENTE un JSON con este formato:
{
  "title": "TÍTULO CORTO Y MAGNÉTICO",
  "notes": "Breve descripción, guión rápido de 2 renglones o nota sobre el enfoque."
}`;

            let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: "application/json" }
                })
            });

            if (!response.ok && (response.status === 404 || response.status === 503)) {
                response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { responseMimeType: "application/json" }
                    })
                });
            }

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(text);
        } catch (error) {
            console.error("AI suggestContent Error:", error);
            return {
                title: `Idea genial para ${category}`,
                notes: "Mostrar el valor de forma rápida y directa."
            };
        }
    },

    getInsights: async (forceRefresh = false, userRole = 'seller', onProgress = null) => {
        const updateProgress = (val) => onProgress && onProgress(val);
        
        // Intelligent Caching (15 minutes to respect API limits)
        if (!forceRefresh && cachedResponse && lastFetchTime && cachedResponseRole === userRole) {
            if (Date.now() - lastFetchTime < 15 * 60 * 1000) {
                updateProgress(1);
                return cachedResponse;
            }
        }

        try {
            updateProgress(0.05);
            // 1. VERIFY PERMISSIONS (SECURITY GATEKEEPER)
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('ai_coach_enabled, role')
                    .eq('id', user.id)
                    .single();
                
                // Restrict if not admin and AI not explicitly enabled
                if (profile && profile.role !== 'admin' && profile.role !== 'leader' && !profile.ai_coach_enabled) {
                    updateProgress(1);
                    return {
                        today_plan: null,
                        strategyA: null,
                        strategyB: null,
                        summary: "El Empire AI Coach está desactivado para tu cuenta.",
                        prediction: "Acceso Restringido",
                        urgency: "Info",
                        urgencyReason: "Tu acceso al coach táctico se activará próximamente.",
                        actionId: "none",
                        actionText: "VOLVER",
                        is_restricted: true
                    };
                }
            }

            updateProgress(0.1);
            const financeState = useFinanceStore.getState();
            const productState = useProductStore.getState();

            const sales = financeState.sales || [];
            const expenses = financeState.expenses || [];
            const products = productState.products || [];

            updateProgress(0.3);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const recentSales = sales.filter(s => new Date(s.created_at) > thirtyDaysAgo && (s.status === 'completed' || s.status === 'exitosa' || s.status === ''));
            const monthlyRevenue = recentSales.reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0);
            const grossProfit = recentSales.reduce((sum, s) => sum + (parseFloat(s.profit_generated) || 0), 0);
            
            const recentExpenses = expenses.filter(e => new Date(e.created_at) > thirtyDaysAgo);
            const monthlyExpenses = recentExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
            const monthlyNetProfit = grossProfit - monthlyExpenses;

            const productSalesMap = {};
            (financeState.saleItems || []).forEach(item => {
                const name = item.products?.name || 'Desconocido';
                if (!productSalesMap[name]) productSalesMap[name] = 0;
                productSalesMap[name] += (item.quantity || 1);
            });
            const topSoldProducts = Object.entries(productSalesMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, qty]) => `${name} (Vendidos: ${qty})`);
            
            const lowStockProducts = products
                .filter(p => p.current_stock > 0 && p.current_stock <= 5)
                .map(p => ({ build_name: p.name, stock: p.current_stock }));
                
            const outOfStockProducts = products
                .filter(p => p.current_stock === 0)
                .map(p => p.name);

            let recentCompleted = [];
            try {
                const { data: compData, error: compErr } = await supabase
                    .from('ai_action_logs')
                    .select('action_type, title, description, executed_at, context_snapshot')
                    .eq('executed', true)
                    .order('executed_at', { ascending: false })
                    .limit(15);
                if (compErr) console.error("Error fetching completed tasks for AI:", compErr);
                else recentCompleted = compData || [];
            } catch (e) {
                console.error("AI completed tasks fetch failed:", e);
            }

            const todaySpan = new Date().toLocaleDateString('es-AR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            const aiPayload = {
                metrics: {
                    monthlyRevenue,
                    grossProfit,
                    monthlyExpenses,
                    monthlyNetProfit,
                    totalSalesCount: recentSales.length
                },
                topSellingProductsLast30Days: topSoldProducts,
                inventory: {
                    criticalStock: lowStockProducts.slice(0, 10),
                    outOfStock: outOfStockProducts.slice(0, 5)
                },
                current_date: todaySpan,
                recent_completed_tasks: recentCompleted.map(c => ({
                    action_type: c.action_type,
                    title: c.title,
                    description: c.description,
                    completed_at: c.executed_at,
                    details: c.context_snapshot
                }))
            };

            const { data: topActions } = await supabase
                .from('ai_action_logs')
                .select('action_type, title, profit_delta, revenue_delta, confidence_score')
                .eq('executed', true)
                .not('profit_delta', 'is', null)
                .order('profit_delta', { ascending: false })
                .limit(10);

            updateProgress(0.5);
            let feedbackContext = "";
            if (topActions && topActions.length > 0) {
                topActions.sort((a, b) => {
                    const weightA = (a.profit_delta || 0) * (a.confidence_score || 1);
                    const weightB = (b.profit_delta || 0) * (b.confidence_score || 1);
                    return weightB - weightA;
                });
                const best3 = topActions.slice(0, 3);
                feedbackContext = `
                FEEDBACK (ESTO FUNCIONÓ ANTES):
                ${best3.map(a => `- ${a.title} -> Generó extra $${a.profit_delta} (Estrategia: ${a.action_type})`).join('\n')}
                Prioriza estrategias que repliquen esto.
                `;
            }

            let testProductsData = [];
            let streetMemory = [];
            let processedHistory = [];
            
            if (userRole === 'admin' || userRole === 'leader') {
                const { data: tpd } = await supabase.from('test_products').select('*').order('created_at', { ascending: false }).limit(20);
                testProductsData = tpd || [];
                const { data: sm } = await supabase.from('street_test_results').select('*').order('created_at', { ascending: false });
                streetMemory = sm || [];
            }

            processedHistory = (streetMemory || []).map(sm => {
                const approached = sm.people_approached || 1;
                const convs = sm.conversations || 0;
                const sales = sm.sales || 0;
                const hours = parseFloat(sm.testing_hours) || 1;
                
                return {
                    ...sm,
                    ratios: { 
                        approach_efficiency: (convs / approached).toFixed(2),
                        sales_velocity: (sales / hours).toFixed(2)
                    }
                };
            });
            
            // -------------------------------------------------------------
            // PAYLOAD COMPRESSION & TEMPORAL ANALYSIS
            // -------------------------------------------------------------
            const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            const dayCounts = {};
            const hourCounts = {};
            
            recentSales.forEach(s => {
                if (s.created_at) {
                    const date = new Date(s.created_at);
                    const day = daysOfWeek[date.getDay()];
                    const hour = date.getHours();
                    dayCounts[day] = (dayCounts[day] || 0) + 1;
                    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
                }
            });
            
            const bestDay = Object.entries(dayCounts).sort((a,b) => b[1] - a[1])[0]?.[0] || 'Indeterminado';
            const peakHourNum = Object.entries(hourCounts).sort((a,b) => b[1] - a[1])[0]?.[0];
            const peakHourStr = peakHourNum ? `${peakHourNum}:00 - ${parseInt(peakHourNum)+1}:00` : 'Indeterminado';

            aiPayload.user_performance = {
                total_wasted_tests_ars: (streetMemory || []).reduce((sum, sm) => sum + (parseFloat(sm.test_cost_ars) || 0), 0),
                safe_mode_active: false
            };
            
            aiPayload.time_stats = {
                best_sales_day: bestDay,
                peak_sales_hour: peakHourStr
            };

            // Compress arrays to save tokens
            aiPayload.test_products = testProductsData.slice(0, 8).map(p => ({
                name: p.product_name,
                status: p.status,
                score: p.validation_score
            }));
            
            aiPayload.street_memory = processedHistory.slice(0, 8).map(sm => ({
                location: sm.location_name,
                ratios: sm.ratios,
                sales: sm.sales
            }));

            const apiKey = await getGoogleApiKey();
            if (!apiKey) throw new Error("API Key missing.");

            const isCordoba = (userRole === 'seller');
            const targetCity = isCordoba ? 'Córdoba Capital' : 'Jujuy Capital';
            const possibleLocations = isCordoba
                ? [
                    'Paseo del Buen Pastor (Nueva Córdoba, fuentes de agua)',
                    'Patio Olmos (Bv. San Juan y Av. Vélez Sarsfield)',
                    'Ciudad Universitaria UNC (Pabellón Argentina / Plaza Seca)',
                    'Plaza San Martín (Centro de Córdoba)',
                    'Peatonal 9 de Julio / Rivera Indarte',
                    'Parque Sarmiento (zona del Rosedal / Pista del Dante)',
                    'Barrio Güemes (Calle Belgrano / Paseo de las Artes)'
                  ]
                : [
                    'Peatonal Belgrano (frente al Banco Nación)',
                    'Plaza Belgrano (frente a la Catedral o frente a Casa de Gobierno)',
                    'Parque San Martín (cerca de la punta o por la zona de los juegos)',
                    'Salida UNJU (Facultad de Humanidades en calle Otero o Facultad de Ingeniería en calle Gorriti)',
                    'Plaza España (atrás de Casa de Gobierno)',
                    'Vieja Estación de Trenes (frente al Centro Cultural Manuel Belgrano)'
                  ];

            const commonContext = `
            CONTEXTO DEL NEGOCIO: ${JSON.stringify(aiPayload, null, 2)}
            ${feedbackContext}
            `;

            // INJECT CALENDAR REMINDER FOR TODAY IF IT EXISTS
            let todayScheduledContext = "";
            const reminderState = useReminderStore.getState();
            if (reminderState && reminderState.reminders) {
                const todayStr = new Date().toISOString().split('T')[0];
                const todayReminder = reminderState.reminders.find(r => r.due_date.startsWith(todayStr) && r.completed === 0);
                if (todayReminder) {
                    todayScheduledContext = `
            🛑 ¡REGLA CRÍTICA INQUEBRANTABLE PARA HOY! 🛑
            El usuario ya ha agendado ESTRICTAMENTE el siguiente contenido para subir hoy en su Calendario:
            - TÍTULO PROGRAMADO: "${todayReminder.title}"
            - NOTAS/CATEGORÍA: "${todayReminder.notes}"
            
            NO sugieras un producto o tema al azar para el "today_plan".
            Debes basar el "today_plan", El Soñador, El Realista, y El Crítico EXACTAMENTE en este contenido programado. Relaciona el contenido programado con algún producto disponible en stock si es posible, pero el enfoque PRINCIPAL debe ser cumplir con esta grabación agendada.
            `;
                }
            }

            updateProgress(0.6);
            const prompt = `
            Eres el Director de Estrategia e Inteligencia Artificial de "Digital Boost Empire" asesorando al equipo en ${targetCity}, Argentina.
            El usuario actual se encuentra físicamente operando y vendiendo en: ${targetCity}.
            
            Tu motor aplica la METODOLOGÍA DISNEY PARA VENTAS Y ESTRATEGIA COMERCIAL, que orquesta 3 roles esenciales para que el equipo ejecute con máximo impacto:
            ${todayScheduledContext}

            1. 🌟 [EL SOÑADOR - The Dreamer | Experiencia WOW & Creatividad Viral]:
               - Diseña la visión y la magia del producto estrella de hoy (basado en stock y margen de ${targetCity}).
               - Crea la estrategia de video viral (Instagram Reels / TikTok):
                 * Gancho Visual (0-3s): Qué MOSTRAR en pantalla para frenar el scroll de inmediato.
                 * Gancho Textual/Verbal (0-3s): Primera frase o texto en pantalla intrigante y magnético.
                 * Estructura del video: Paso a paso (0-3s Gancho | 4-10s Dolor/Solución | 11-15s Llamado a la acción).
                 * Guión de locución palabra por palabra: Qué decir a cámara o en voz en off (humano, empático, persuasivo).
                 * Copy / Caption para redes: Texto listo para copiar y pegar con hashtags (${isCordoba ? '#Cordoba #NuevaCordoba #CBA #Ofertas' : '#Jujuy #SanSalvadorDeJujuy #Ofertas'}) y llamada al DM/WhatsApp.

            2. 🎯 [EL REALISTA - The Realist | Ejecución en Terreno, Ubicaciones & Horarios en ${targetCity}]:
               - Diseña el despliegue físico y abordaje presencial 100% ambientado en ${targetCity}:
                 * Ubicaciones concretas rotativas en ${targetCity}: ${possibleLocations.join(' | ')}.
                 * Horarios pico de impacto: Horarios exactos recomendados para venta presencial y picos de tráfico en ${targetCity}.
                 * Target / Perfil a abordar: A quiénes interceptar y cómo identificarlos rápidamente (${isCordoba ? 'Estudiantes universitarios de Nueva Córdoba / UNC, oficinistas del centro o jóvenes en Patio Olmos' : 'Estudiantes universitarios de UNJU, transeúntes de Peatonal Belgrano o familias en Plaza Belgrano'}).
                 * Guión cara a cara: Pitch natural, empático y directo para hablar en persona adaptado al público local.
                 * Guión de respuesta rápida en WhatsApp para cerrar ventas cuando consulten al privado.

            3. 🛡️ [EL CRÍTICO - The Critic | Matador de Objeciones & Blindaje de Cierre]:
               - Identifica la objeción o fricción principal que pondrá el cliente ("es caro", "no lo necesito ahora", "después te aviso", "no tengo efectivo").
               - Provee la respuesta matadora (Objection Killer) para desarmar la duda con elegancia y cerrar la venta en el acto.
               - Justificación basada en stock disponible (${isCordoba ? 'Stock Córdoba' : 'Stock General/Local'}) y margen de rentabilidad.

            ${commonContext}

            * REGLAS DE ROTACIÓN DE LUGARES EN ${targetCity.toUpperCase()}:
            Lee 'recent_completed_tasks'. Si un lugar ya fue visitado recientemente, NO lo repitas hoy. Rota a una zona diferente de las opciones de ${targetCity}.

            * REGLAS DE SECUENCIA DE VIDEOS:
            Si ya se hizo un video de gancho para el producto X en tareas recientes, sugiere un ángulo diferente (demostración en vivo, prueba de resistencia, unboxing o combo) o avanza con otro producto de buen margen.

            DEVUELVE ÚNICAMENTE JSON PURO (sin markdown, sin bloques de código):
            {
              "today_plan": {
                "product": "Nombre exacto del producto estrella",
                "disney_methodology": {
                  "dreamer_vision": "La promesa de valor y experiencia WOW del producto",
                  "realist_action": "La acción prioritaria de ejecución en calle y redes en ${targetCity}",
                  "critic_defense": "Cómo se blinda la venta ante dudas y objeciones"
                },
                "schedule": "Horarios EXACTOS separados por zonas en ${targetCity}, ej: '${isCordoba ? '11:00-13:30 → Patio Olmos. 17:30-20:00 → Buen Pastor' : '11:00-13:00 → Peatonal Belgrano. 17:30-20:00 → Salida UNJU'}'",
                "location": "Dirección o zona concreta en ${targetCity} (ej: '${isCordoba ? 'Paseo del Buen Pastor frente a las fuentes' : 'Peatonal Belgrano frente al Banco Nación'}')",
                "target": "Descripción del cliente ideal a abordar en ${targetCity}",
                "expected_sales": "Estimado de unidades a vender hoy",
                "script": "GUIÓN CARA A CARA / WHATSAPP (Natural, empático y directo)",
                "video_direction": {
                  "visual_hook": "GANCHO VISUAL (0-3s): Qué MOSTRAR en pantalla de inmediato.",
                  "verbal_hook": "GANCHO TEXTUAL (0-3s): Primera frase o texto en pantalla.",
                  "structure": "Estructura paso a paso (0-3s Gancho | 4-10s Demostración | 11-15s CTA)",
                  "spoken_script": "LOCUCIÓN PALABRA POR PALABRA: Qué decir a cámara o voz en off."
                },
                "best_copy": "COPY / CAPTION COMPLETO PARA REELS/TIKTOK (Listo para copiar y pegar con hashtags)",
                "main_objection": "Objeción típica detectada por El Crítico (ej: 'Me parece caro')",
                "objection_killer": "Respuesta matadora para desarmar la objeción y cerrar",
                "reason": "Razón táctica de por qué este producto y estrategia funcionan hoy en ${targetCity}"
              },
              "missions": [
                { "type": "online", "action": "Subir video de [Producto] a Reels/TikTok", "goal": "Generar consultas al WhatsApp", "priority": "Alta" },
                { "type": "offline", "action": "Venta en [Lugar de ${targetCity}] en horario [Horario]", "goal": "Cerrar ventas presenciales", "priority": "Alta" },
                { "type": "hybrid", "action": "Publicar historia interactiva con combo", "goal": "Venta cruzada", "priority": "Media" }
              ],
              "strategyA": { "name": "PLAN A: TRACCIÓN DIRECTA (EL REALISTA)", "plan": "Acción inmediata de guerrilla para generar caja rápido hoy en ${targetCity}", "risk_level": "Bajo" },
              "strategyB": { "name": "PLAN B: ESCALADO Y REINVERSIÓN (EL SOÑADOR + GEMINI)", "plan": "Reinversión o armado de combo de alto margen", "suggestedInvestment": "$45.000", "suggestedStock": "10 unidades", "estimatedMargin": "40%" },
              "pattern_insights": ["Patrón 1", "Patrón 2"],
              "recommended_bundles": [{ "products": ["Producto A", "Producto B"], "price_strategy": "Estrategia de combo", "expected_conversion_boost": "25%" }],
              "performance_summary": "Evaluación del rendimiento actual y financiero",
              "prediction": "Predicción de ventas y movimiento",
              "urgency": "Estable|Atención|Crítico",
              "urgencyReason": "Razón de urgencia",
              "actionId": "create_promo",
              "actionText": "EJECUTAR PLAN"
            }`;

            updateProgress(0.8);
            let response;
            let retries = 3;
            let backoff = 1000;
            const primaryModel = 'gemini-3.5-flash';
            const fallbackModel = 'gemini-2.5-flash';
            
            const makeRequest = async (modelName) => {
                return await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            responseMimeType: "application/json"
                        }
                    })
                });
            };

            while (retries > 0) {
                response = await makeRequest(primaryModel);
                if (response.status === 429 || response.status === 503) {
                    console.warn(`[EmpireAIService] Gemini API Overloaded/RateLimited (HTTP ${response.status}). Retrying primary model... Retries left: ${retries - 1}`);
                    retries--;
                    await new Promise(r => setTimeout(r, backoff));
                    backoff *= 2;
                } else break;
            }

            // Fallback to gemini-2.5-flash if primary failed with 503/404
            if (!response.ok && (response.status === 503 || response.status === 404)) {
                console.log(`[EmpireAIService] Primary model ${primaryModel} failed with status ${response.status}. Falling back to ${fallbackModel}...`);
                response = await makeRequest(fallbackModel);
            }

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            updateProgress(0.95);
            const data = await response.json();
            let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                text = text.substring(firstBrace, lastBrace + 1);
            }
            const parsedInsights = JSON.parse(text);

            // Save today_plan and missions into the DB for tracking
            try {
                // Delete existing unexecuted plan and missions
                const fromQuery = supabase.from('ai_action_logs');
                if (typeof fromQuery.delete === 'function') {
                    const deleteQuery = fromQuery.delete();
                    if (typeof deleteQuery.eq === 'function') {
                        await deleteQuery
                            .eq('executed', false)
                            .in('action_type', ['today_plan', 'mission']);
                    }
                }

                // Prepare inserts
                const inserts = [];
                
                // 1. Insert today_plan
                if (parsedInsights.today_plan) {
                    const planTitle = `Plan Disney: ${parsedInsights.today_plan.product || 'Estrategia del Día'}`;

                    inserts.push({
                        action_type: 'today_plan',
                        title: planTitle,
                        description: parsedInsights.today_plan.reason || parsedInsights.today_plan.script || 'Plan del día',
                        context_snapshot: parsedInsights.today_plan,
                        executed: false,
                        confidence_score: 0.95
                    });
                }

                // 2. Insert missions
                if (parsedInsights.missions && Array.isArray(parsedInsights.missions)) {
                    parsedInsights.missions.forEach(m => {
                        inserts.push({
                            action_type: 'mission',
                            title: m.action || 'Misión del día',
                            description: m.goal || '',
                            context_snapshot: m,
                            executed: false,
                            confidence_score: m.priority === 'Alta' ? 0.9 : m.priority === 'Media' ? 0.7 : 0.5
                        });
                    });
                }

                if (inserts.length > 0) {
                    const insertQuery = supabase.from('ai_action_logs').insert(inserts);
                    
                    const { data: insertedRows, error: insertError } = typeof insertQuery.select === 'function'
                        ? await insertQuery.select('*')
                        : await insertQuery;

                    if (insertError) {
                        console.error("Error inserting generated plans/missions:", insertError);
                    } else if (insertedRows && insertedRows.length > 0) {
                        // Map the database IDs back to the parsedInsights object
                        const planRow = insertedRows.find(r => r.action_type === 'today_plan');
                        if (planRow && parsedInsights.today_plan) {
                            parsedInsights.today_plan.id = planRow.id;
                        }

                        const missionRows = insertedRows.filter(r => r.action_type === 'mission');
                        if (parsedInsights.missions && Array.isArray(parsedInsights.missions)) {
                            parsedInsights.missions = parsedInsights.missions.map(m => {
                                const matchedRow = missionRows.find(mr => mr.title === m.action);
                                return {
                                    ...m,
                                    id: matchedRow ? matchedRow.id : null
                                };
                            });
                        }
                    }
                }
            } catch (dbErr) {
                console.error("Database tracking logging failed:", dbErr);
            }
            
            cachedResponse = parsedInsights;
            lastFetchTime = Date.now();
            cachedResponseRole = userRole;
            updateProgress(1);
            return parsedInsights;

        } catch (error) {
            console.error("AI Error:", error);
            updateProgress(1);
            const pState = useProductStore.getState();
            const products = pState.products || [];
            const isCordoba = (userRole === 'seller');
            const critical = products.filter(p => (isCordoba && p.stock_cordoba !== undefined ? p.stock_cordoba > 0 && p.stock_cordoba <= 3 : p.current_stock > 0 && p.current_stock <= 3) || (p.current_stock > 0 && p.current_stock <= 3));
            const stagnant = products.filter(p => (isCordoba && p.stock_cordoba !== undefined ? p.stock_cordoba > 15 : p.current_stock > 15) || (p.current_stock > 15));
            const chosenProduct = critical[0]?.name || products[0]?.name || "Gadgets Imperiales";
            
            return {
                today_plan: { 
                    product: chosenProduct, 
                    location: isCordoba ? "Paseo del Buen Pastor / Patio Olmos (Nueva Córdoba)" : "Peatonal Belgrano / Salida UNJU / Centro Jujuy", 
                    schedule: isCordoba ? "11:00-13:30 → Patio Olmos | 17:30-20:00 → Buen Pastor" : "11:00-13:30 → Peatonal Belgrano | 17:30-20:00 → Plaza Belgrano",
                    target: isCordoba ? "Estudiantes universitarios de Nueva Córdoba y jóvenes con celular en mano" : "Jóvenes y adultos con celular en mano buscando soluciones rápidas",
                    script: "¡Hola! Te muestro en 10 segundos cómo esto te salva la batería todo el día.",
                    video_direction: {
                        visual_hook: "Mostrá el producto funcionando en una situación límite en los primeros 2 segundos.",
                        verbal_hook: "¿Sabías que el 90% comete este error al salir a la calle?",
                        structure: "0-3s Gancho | 4-10s Demostración del dolor y alivio | 11-15s Llamado a enviar mensaje",
                        spoken_script: "Si estás cansado de quedarte sin batería en la calle, mira esto..."
                    },
                    best_copy: `🔥 ¡Descubrí el ${chosenProduct}! Unidades limitadas. Escribinos al MD o link de WhatsApp para llevarte el tuyo con garantía oficial. #${isCordoba ? 'Cordoba #NuevaCordoba #CBA' : 'Jujuy'} #Ofertas #Tecno`,
                    main_objection: "¿Es de buena calidad y tiene garantía?",
                    objection_killer: "Cuenta con garantía directa de Digital Boost Empire y podés probarlo acá mismo antes de pagar.",
                    reason: `Método Disney: Alta rentabilidad y demanda constante en ${isCordoba ? 'Córdoba' : 'Jujuy'}.`
                },
                missions: [
                    { type: "online", action: `Publicar reel/video de ${chosenProduct}`, goal: "5 consultas por WhatsApp", priority: "Alta" },
                    { type: "offline", action: isCordoba ? "Testeo presencial en Buen Pastor" : "Testeo presencial en Peatonal Belgrano", goal: "3 ventas cerradas", priority: "Alta" }
                ],
                strategyA: { 
                    name: "PLAN A: TRACCIÓN DIRECTA (EL REALISTA)", 
                    plan: stagnant[0] ? `Lanza una oferta especial de ${stagnant[0].name} para liberar capital hoy mismo.` : "Identifica productos con stock alto y dales salida con combos en redes y calle." 
                },
                strategyB: { 
                    name: "PLAN B: INVERSIÓN Y REPOSICIÓN (EL SOÑADOR + GEMINI)", 
                    plan: critical[0] ? `Es urgente reponer ${critical[0].name}. Hay demanda insatisfecha.` : "Analiza los productos más vendidos y refuerza stock.",
                    suggestedInvestment: "$45.000 (Estimado)",
                    suggestedStock: "12 unidades",
                    estimatedMargin: "45%"
                },
                summary: "Coach Táctico Disney: Integrando estrategia de video viral con presencia física.",
                prediction: "Alta tasa de conversión aplicando los 3 roles de Walt Disney.",
                urgency: "Atención",
                urgencyReason: "Gemini Quota limit o modo contingencia activo.",
                actionId: "restock",
                actionText: "VER INVENTARIO",
                is_fallback: true
            };
        }
    },

    markActionAsExecuted: async (id) => {
        if (!id) return;
        try {
            const { error } = await supabase
                .from('ai_action_logs')
                .update({ 
                    executed: true, 
                    executed_at: new Date().toISOString() 
                })
                .eq('id', id);
            if (error) console.error("Error marking action as executed:", error);
        } catch (e) {
            console.error("Failed to mark action as executed:", e);
        }
    },

    checkCompletedActions: async (ids) => {
        if (!ids || ids.length === 0) return [];
        try {
            const { data, error } = await supabase
                .from('ai_action_logs')
                .select('id')
                .in('id', ids)
                .eq('executed', true);
            if (error) {
                console.error("Error checking completed actions:", error);
                return [];
            }
            return (data || []).map(row => row.id);
        } catch (e) {
            console.error("Failed to check completed actions:", e);
            return [];
        }
    }
};
