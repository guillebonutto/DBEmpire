import { supabase } from './supabase';
import { useFinanceStore } from '../store/useFinanceStore';
import { useProductStore } from '../store/useProductStore';

let cachedResponse = null;
let lastFetchTime = null;

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
        if (!forceRefresh && cachedResponse && lastFetchTime) {
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
                if (profile && profile.role !== 'admin' && !profile.ai_coach_enabled) {
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
            
            if (userRole === 'admin') {
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
            
            aiPayload.user_performance = {
                total_wasted_tests_ars: (streetMemory || []).reduce((sum, sm) => sum + (parseFloat(sm.test_cost_ars) || 0), 0),
                safe_mode_active: false
            };
            aiPayload.test_products = testProductsData;
            aiPayload.street_memory = processedHistory;

            const { data: settingsData } = await supabase.from('settings').select('value').eq('key', 'google_api_key').single();
            if (!settingsData?.value) throw new Error("API Key missing.");

            updateProgress(0.6);
            let prompt = "";
            const commonContext = `
            CONTEXTO DEL NEGOCIO: ${JSON.stringify(aiPayload, null, 2)}
            ${feedbackContext}
            `;

            if (userRole === 'admin') {
                prompt = `
                Eres el "Empire AI Coach", el estratega máximo de "Digital Boost Empire" en Jujuy.
                ${commonContext}
                TAREAS: Misiones tácticas (offline, online, híbridas), Estrategia A (Liquidación), Estrategia B (Inversión).
                REQUERIMIENTO: Identifica riesgos, oportunidades de crecimiento y planes de acción concretos.
                DEVUELVE JSON PURO: {
                  "today_plan": { "product": "X", "location": "Y", "script": "Z", "reason": "W", "target": "Público", "expected_sales": "N" },
                  "missions": [
                    { "type": "offline|online|hybrid", "action": "...", "goal": "...", "priority": "Alta|Media|Baja" }
                  ],
                  "strategyA": { "name": "LIQUIDACIÓN", "plan": "...", "risk_level": "..." },
                  "strategyB": { "name": "INVERSIÓN", "plan": "...", "suggestedInvestment": "$X", "suggestedStock": "N un.", "estimatedMargin": "X%" },
                  "recommended_bundles": [{ "products": ["A", "B"], "price_strategy": "...", "expected_conversion_boost": "X%" }],
                  "product_insights": [{ "name": "X", "observation": "...", "bottleneck_alert": "...", "objection_killer_script": "...", "next_step": { "action": "import|discard|test", "risk_level": "low|med|high", "confidence": 0.X, "suggested_units": N, "safe_units": M, "reason": "..." } }],
                  "pattern_insights": ["Patrón 1", "Patrón 2"],
                  "positioning_strategy": ["Tip 1", "Tip 2"],
                  "expansion_strategy": ["Tip 1", "Tip 2"],
                  "discovery_products": [{ "name": "X", "test_priority": "high|low", "local_fit_score": "X/10", "reason": "...", "estimated_cost": "$X", "suggested_test": { "city": "Jujuy", "location": "...", "script": "...", "goal": "...", "validation_metric": "..." } }],
                  "performance_summary": "...",
                  "prediction": "...", "urgency": "...", "urgencyReason": "...", "actionId": "create_promo", "actionText": "EJECUTAR"
                }`;
            } else {
                prompt = `
                Eres el "Asistente de Marketing Digital" de Digital Boost Empire. Socio espera instrucciones para REDES SOCIALES.
                ${commonContext}
                IMPORTANTE: Solo estrategias ONLINE (Instagram, TikTok, WhatsApp).
                OBJETIVO: Generar ventas mediante contenido viral.
                DEVUELVE JSON PURO: {
                  "today_plan": { 
                    "product": "X", 
                    "platform": "Instagram|TikTok|WA", 
                    "best_copy": "Copia este texto: [Copy con emojis y CTA]",
                    "script": "Guion para video si aplica", 
                    "reason": "Por qué publicar esto hoy" 
                  },
                  "missions": [
                    { "type": "online", "action": "Ej: Subir 3 historias de X", "goal": "Generar X consultas" }
                  ],
                  "strategyA": { "name": "ESTRATEGIA VIRAL (REELS/TIKTOK)", "plan": "..." },
                  "strategyB": { "name": "ESTRATEGIA WHATSAPP (ESTADOS/GRUPOS)", "plan": "..." },
                  "summary": "Resumen de lo que debe publicar hoy",
                  "prediction": "...", "urgency": "Estable", "urgencyReason": "...", "actionId": "create_promo", "actionText": "VER"
                }`;
            }

            updateProgress(0.8);
            let response;
            let retries = 3;
            let backoff = 1000;
            while (retries > 0) {
                response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${settingsData.value}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
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
            const parsedInsights = JSON.parse(text);
            
            cachedResponse = parsedInsights;
            lastFetchTime = Date.now();
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
                today_plan: userRole === 'admin' ? { 
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
