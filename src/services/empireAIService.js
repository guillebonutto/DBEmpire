import { supabase } from './supabase';
import { useFinanceStore } from '../store/useFinanceStore';
import { useProductStore } from '../store/useProductStore';

let cachedResponse = null;
let lastFetchTime = null;
let cachedResponseRole = null;

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
                }
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

            const { data: settingsData } = await supabase.from('settings').select('value').eq('key', 'google_api_key').single();
            if (!settingsData?.value) throw new Error("API Key missing.");

            updateProgress(0.6);
            let prompt = "";
            const commonContext = `
            CONTEXTO DEL NEGOCIO: ${JSON.stringify(aiPayload, null, 2)}
            ${feedbackContext}
            `;

            if (userRole === 'admin' || userRole === 'leader') {
                prompt = `
                Eres una red integrada de tres agentes virtuales que colaboran internamente para asesorar de forma táctica al dueño de "Digital Boost Empire" en Jujuy, Argentina. Este sistema de orquestación interna simula las fortalezas de los mejores modelos del mercado:

                1. [AGENTE VIRTUAL CLAUDE] (Empatía, Psicología y Copywriting): Inspirado en Claude 3.5 Sonnet. Tu objetivo es inyectar una profunda empatía por el esfuerzo del comerciante, brindar un tono pedagógico de elite, y redactar guiones ("script") y consejos estratégicos que se sientan 100% humanos, persuasivos y empáticos. El guión debe evitar frases trilladas o robóticas.
                
                2. [AGENTE VIRTUAL GROK] (Estratega de Guerrilla y Tendencias en Vivo): Inspirado en Grok. Tu estilo es pragmático, audaz e informal. Te enfocas en ganchos rápidos, tácticas de venta física agresivas en Jujuy (cómo interceptar de forma inteligente, psicología de calle), y humor táctico.
                
                3. [AGENTE VIRTUAL GEMINI] (Director Financiero y Compilador): Tu motor principal. Te encargas del análisis matemático estricto, la consistencia de inventario y asegurar que la salida de datos sea un JSON estructuralmente perfecto y libre de errores.

                ${commonContext}

                REGLA CRÍTICA: Debes fusionar la consistencia matemática de Gemini, la empatía y tacto de Claude en el trato y guiones, y la astucia táctica callejera de Grok. Sé EXTREMADAMENTE CONCRETO en zonas geográficas de Jujuy, horarios y productos.

                DEVUELVE ÚNICAMENTE JSON PURO (sin markdown, sin texto extra):
                {
                  "today_plan": {
                    "product": "Nombre exacto del producto que más conviene vender HOY basado en stock y margen",
                    "schedule": "Horarios EXACTOS separados por zonas, ej: '10:00-12:30 → Peatonal Belgrano. 17:00-20:00 → Salida UNJU'",
                    "location": "Dirección o zona concreta en Jujuy capital (ej. Peatonal Belgrano frente al Banco Nación) — NO digas solo 'el centro'",
                    "target": "Descripción del cliente ideal a abordar (ej. Jóvenes 18-25 con auriculares o mirando el celular)",
                    "script": "GUIÓN DE CLAUDE (Empatía pura y persuasión cara a cara. Natural, sin sonar robótico ni agresivo. Ej. 'Disculpa el atrevimiento, ¿te puedo hacer una pregunta rápida? Si tienes 2 minutos te muestro algo que...')",
                    "reason": "RAZÓN TÁCTICA DE GROK (Por qué este producto y lugar encajan hoy, con tu estilo audaz e informal de calle)",
                    "expected_sales": "Número estimado de unidades"
                  },
                  "missions": [
                    { "type": "offline|online|hybrid", "action": "Acción concreta con verbo y objeto", "goal": "Resultado esperado medible", "priority": "Alta|Media|Baja" }
                  ],
                  "strategyA": { "name": "PLAN A (TRACCIÓN INMEDIATA - BY CLAUDE/GROK)", "plan": "Acción inmediata de guerrilla para generar caja rápido hoy", "risk_level": "Bajo|Medio|Alto" },
                  "strategyB": { "name": "PLAN B (INVERSIÓN TÁCTICA - BY GEMINI)", "plan": "Reinversión de capital en stock crítico sugerido por el modelo financiero", "suggestedInvestment": "$X.XXX", "suggestedStock": "N unidades", "estimatedMargin": "X%" },
                  "pattern_insights": ["Patrón de comportamiento detectado 1", "Patrón 2"],
                  "recommended_bundles": [{ "products": ["Producto A", "Producto B"], "price_strategy": "Estrategia concreta de precio combo", "expected_conversion_boost": "X%" }],
                  "product_insights": [{ "name": "Nombre exacto", "observation": "Observación basada en los datos", "bottleneck_alert": "Cuello de botella si aplica o 'Ninguno'", "objection_killer_script": "Matador de objeciones por Claude o 'N/A'", "next_step": { "action": "import|discard|test", "risk_level": "low|med|high", "confidence": 0.8, "suggested_units": 5, "safe_units": 3, "reason": "Razón basada en datos" } }],
                  "positioning_strategy": ["Tip de posicionamiento en mercado por Claude", "Tip por Grok"],
                  "expansion_strategy": ["Paso concreto 1", "Paso 2"],
                  "discovery_products": [{ "name": "Producto", "test_priority": "high|low", "local_fit_score": "X/10", "reason": "Por qué encaja en Jujuy", "estimated_cost": "$X", "suggested_test": { "city": "Jujuy", "location": "Lugar exacto", "script": "Script de prueba", "goal": "Meta medible", "validation_metric": "Métrica de validación" } }],
                  "performance_summary": "Evaluación del rendimiento actual y financiero por Gemini",
                  "prediction": "Predicción fundamentada en los datos",
                  "urgency": "Estable|Atención|Crítico",
                  "urgencyReason": "Razón de urgencia",
                  "actionId": "create_promo",
                  "actionText": "EJECUTAR"
                }`;
            } else {
                prompt = `
                Eres una red integrada de tres agentes virtuales colaborando internamente para guiar al socio vendedor de "Digital Boost Empire" en la creación de contenido online viral y ventas rápidas:

                1. [AGENTE VIRTUAL CLAUDE] (Empatía y Storytelling Emocional): Inspirado en Claude 3.5 Sonnet. Enfocado en generar guiones de locución con profunda resonancia emocional, ganchos narrativos inteligentes y llamadas a la acción que generen confianza y empatía real en el cliente online.
                
                2. [AGENTE VIRTUAL GROK] (Director de Tendencias Virales y Humor Audaz): Inspirado en Grok. Encargado de proponer hooks ultra visuales, ganchos de retención de 3 segundos muy audaces o cómicos, ganchos absurdos pero efectivos de TikTok/Reels, y captions divertidos/desafiantes.
                
                3. [AGENTE VIRTUAL GEMINI] (Compilador y Estratega de Métricas): Encargado de que la recomendación se enfoque en los productos con mayor margen, stock saludable y la salida final de datos JSON sea impecable.

                ${commonContext}
                
                REGLA CRÍTICA: Fusiona la creatividad viral de Grok con la delicadeza humana y narrativa de Claude, respaldado por la estructura rigurosa de Gemini.

                DEVUELVE JSON PURO: {
                  "today_plan": { 
                    "product": "Nombre del producto", 
                    "platform": "Instagram Reels | TikTok", 
                    "video_direction": {
                        "visual_hook": "GANCHO VISUAL DE GROK: Qué MOSTRAR en los primeros 3 segundos para captar la atención de inmediato.",
                        "verbal_hook": "GANCHO VERBAL DE CLAUDE: Qué decir o poner en texto en pantalla los primeros 3 segundos (Emocional y atrapante).",
                        "structure": "Estructura paso a paso del video (ej. 0-3s [Gancho], 4-10s [Demostración de dolor/solución], 11-15s [Llamado a la acción])",
                        "spoken_script": "LOCUCIÓN DE CLAUDE (Guión palabra por palabra para la voz en off o hablar a cámara. Súper natural, empático y persuasivo.)"
                    },
                    "best_copy": "DESCRIPCIÓN DE GROK (Caption audaz, entretenido, emojis y hashtags estratégicos)",
                    "script": "GUIÓN OFFLINE DE RESPUESTA EN WHATSAPP (Por Claude, súper servicial y empático cuando la gente te consulte al privado)",
                    "reason": "Explicación táctica del combo y por qué esta tendencia funciona hoy" 
                  },
                  "missions": [
                    { "type": "online", "action": "Subir X a redes", "goal": "Generar X consultas" }
                  ],
                  "strategyA": { "name": "PLAN A (VIRALIDAD INMEDIATA)", "plan": "Propuesta de video rápido de hacer hoy en redes" },
                  "strategyB": { "name": "PLAN B (VENTA DIRECTA)", "plan": "Estrategia para cerrar rápido en historias de WhatsApp/Instagram con los interesados" },
                  "summary": "Resumen táctico del día compilado por Gemini",
                  "prediction": "Predicción de visualizaciones o consultas estimadas", 
                  "urgency": "Estable", 
                  "actionId": "create_promo", 
                  "actionText": "GRABAR AHORA"
                }`;
            }

            updateProgress(0.8);
            let response;
            let retries = 3;
            let backoff = 1000;
            while (retries > 0) {
                response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${settingsData.value}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            responseMimeType: "application/json"
                        }
                    })
                });
                if (response.status === 429) {
                    retries--;
                    await new Promise(r => setTimeout(r, backoff));
                    backoff *= 2;
                } else break;
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
            const critical = products.filter(p => p.current_stock > 0 && p.current_stock <= 3);
            const stagnant = products.filter(p => p.current_stock > 15);
            
            return {
                today_plan: (userRole === 'admin' || userRole === 'leader') ? { 
                    product: critical[0]?.name || "Gadgets", 
                    location: "Plaza Belgrano / UNJU / Centro Jujuy", 
                    script: "¡Últimas unidades! No te quedes sin el tuyo.", 
                    reason: "Modo contingencia: Foco en rotación física en Jujuy." 
                } : null,
                strategyA: { 
                    name: "ESTRATEGIA A (LIQUIDAR)", 
                    plan: stagnant[0] ? `Lanza una oferta especial de ${stagnant[0].name} para liberar capital hoy mismo.` : "Identifica productos con stock alto y dales salida con combos." 
                },
                strategyB: { 
                    name: "ESTRATEGIA B (DEMANDAR)", 
                    plan: critical[0] ? `Es urgente reponer ${critical[0].name}. Hay demanda insatisfecha.` : "Analiza los productos más vendidos y refuerza stock.",
                    suggestedInvestment: "$45.000 (Estimado)",
                    suggestedStock: "12 unidades",
                    estimatedMargin: "45%"
                },
                summary: userRole === 'admin' ? "CFO Offline: Generando estrategias basadas en inventario local." : "Resumen de inventario disponible.",
                prediction: "Estable con tendencia a rotación de stock crítico.",
                urgency: "Atención",
                urgencyReason: "Gemini Quota limit o acceso limitado.",
                actionId: "restock",
                actionText: "VER INVENTARIO",
                is_fallback: true
            };
        }
    }
};
