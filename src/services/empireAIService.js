import { useFinanceStore } from '../store/useFinanceStore';
import { useProductStore } from '../store/useProductStore';
import { supabase } from './supabase';

let cachedResponse = null;
let lastFetchTime = null;

export const EmpireAIService = {
    // -------------------------------------------------------------
    // FEEDBACK LOOP & TRACKING
    // -------------------------------------------------------------
    
    // 1. Logs missions directly to DB when they are generated
    logAIActions: async (missions, contextSnapshot) => {
        if (!missions || missions.length === 0) return;
        try {
            const timestampRounded = Math.floor(Date.now() / (12 * 60 * 60 * 1000)); // Every 12H

            const logs = [];
            for (const m of missions) {
                // Generar hash único para evitar spam en BD si se consulta muchas veces lo mismo el mismo día
                const rawString = `${m.title}_${m.action_type}_${timestampRounded}`;
                let hashNum = 0;
                for (let i = 0; i < rawString.length; i++) {
                    hashNum = Math.imul(31, hashNum) + rawString.charCodeAt(i) | 0;
                }
                const action_hash = `hash_${Math.abs(hashNum)}`;

                logs.push({
                    title: m.title,
                    description: m.reason,
                    action_type: m.action_type,
                    impact_predicted: m.impact,
                    context_snapshot: contextSnapshot,
                    executed: false,
                    evaluation_window_hours: 48,
                    action_hash: action_hash
                });
            }

            // Upsert on conflict allows skipping duplicates safely
            const { error } = await supabase.from('ai_action_logs').upsert(logs, { onConflict: 'action_hash' });
            if (error) console.log("Failed to log AI actions (Possible unique constraint):", error.message);
        } catch (e) {
            console.log("Error logic AI:", e);
        }
    },

    // 2. Marks mission as executed by the user (Tap on HomeScreen AI button)
    markActionExecuted: async (title) => {
        try {
            await supabase
                .from('ai_action_logs')
                .update({ executed: true, executed_at: new Date().toISOString() })
                .eq('title', title)
                .eq('executed', false)
                .order('created_at', { ascending: false })
                .limit(1);
        } catch (e) {
            console.log("Failed to mark action executed:", e);
        }
    },

    // 3. Automated evaluation function (to run on login/Home)
    evaluatePendingActions: async () => {
        try {
            const { data: logs } = await supabase
                .from('ai_action_logs')
                .select('*')
                .eq('executed', true)
                .is('profit_delta', null);

            if (!logs || logs.length === 0) return;

            const financeState = useFinanceStore.getState();
            // We use simple evaluation as requested
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const recentSales = (financeState.sales || []).filter(s => new Date(s.created_at) > thirtyDaysAgo);
            const currentRevenue = recentSales.reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0);
            const currentProfit = recentSales.reduce((sum, s) => sum + (parseFloat(s.profit_generated) || 0), 0);

            for (const log of logs) {
                const executedAt = new Date(log.executed_at);
                const hrsPassed = Math.abs(new Date() - executedAt) / 36e5;
                
                if (hrsPassed >= (log.evaluation_window_hours || 48)) {
                    // Time is up! Let's evaluate
                    const prevSnapshot = log.context_snapshot || {};
                    const prevProfit = prevSnapshot.monthlyProfit || 0;
                    const prevRevenue = prevSnapshot.monthlyRevenue || 0;
                    
                    const profit_delta = currentProfit - prevProfit;
                    const revenue_delta = currentRevenue - prevRevenue;

                    await supabase
                        .from('ai_action_logs')
                        .update({
                            result_snapshot: { currentProfit, currentRevenue },
                            profit_delta,
                            revenue_delta
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
    getInsights: async (forceRefresh = false) => {
            // Intelligent Caching (2 minutes for agile loop tracking)
        if (!forceRefresh && cachedResponse && lastFetchTime) {
            if (Date.now() - lastFetchTime < 2 * 60 * 1000) {
                return cachedResponse;
            }
        }

        try {
            // Note: evaluatePendingActions is now handled by the Supabase Edge Function (evaluate-ai-actions)
            // that runs via cron every hour. No need to trigger it from the client.
            const financeState = useFinanceStore.getState();
            const productState = useProductStore.getState();

            // 3. Process features for AI (Data Reduction to save tokens and improve context)
            const sales = financeState.sales || [];
            const expenses = financeState.expenses || [];
            const products = productState.products || [];

            // Calculate basic metrics for the prompt
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            // 1. Calculate Real Profit and Expenses
            const recentSales = sales.filter(s => new Date(s.created_at) > thirtyDaysAgo && (s.status === 'completed' || s.status === 'exitosa' || s.status === ''));
            const monthlyRevenue = recentSales.reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0);
            const grossProfit = recentSales.reduce((sum, s) => sum + (parseFloat(s.profit_generated) || 0), 0);
            
            const recentExpenses = expenses.filter(e => new Date(e.created_at) > thirtyDaysAgo);
            const monthlyExpenses = recentExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
            const monthlyNetProfit = grossProfit - monthlyExpenses;

            // 2. Identify Top Selling Products from recent sales (Sales Velocity)
            const recentSaleIds = new Set(recentSales.map(s => s.id));
            const recentSaleItems = (financeState.saleItems || []).filter(item => recentSaleIds.has(item.sale_id));
            
            const productSalesMap = {};
            recentSaleItems.forEach(item => {
                const name = item.products?.name || 'Desconocido';
                if (!productSalesMap[name]) productSalesMap[name] = 0;
                productSalesMap[name] += (item.quantity || 1);
            });
            const topSoldProducts = Object.entries(productSalesMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, qty]) => `${name} (Vendidos: ${qty})`);
            
            // 3. Inventory snapshot
            const lowStockProducts = products
                .filter(p => p.current_stock > 0 && p.current_stock <= 5)
                .map(p => ({ build_name: p.name, stock: p.current_stock }));
                
            const outOfStockProducts = products
                .filter(p => p.current_stock === 0)
                .map(p => p.name);

            // Create highly concise payload
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

            // 3.B Fetch Feedback Loop Context (What worked before?)
            // Note: Since Supabase raw SQL expressions in order() are limited via REST,
            // we fetch the best performing ones normally and then sort them in JS by profit_delta * confidence_score
            const { data: topActions } = await supabase
                .from('ai_action_logs')
                .select('action_type, title, profit_delta, revenue_delta, confidence_score')
                .eq('executed', true)
                .not('profit_delta', 'is', null)
                .order('profit_delta', { ascending: false })
                .limit(10);

            let feedbackContext = "";
            if (topActions && topActions.length > 0) {
                // Sort by true weighted impact (profit * confidence)
                topActions.sort((a, b) => {
                    const weightA = (a.profit_delta || 0) * (a.confidence_score || 1);
                    const weightB = (b.profit_delta || 0) * (b.confidence_score || 1);
                    return weightB - weightA;
                });
                
                const best3 = topActions.slice(0, 3);

                feedbackContext = `
                FEEDBACK LOOP DEL NEGOCIO (ESTO FUNCIONÓ ANTES, PRIORÍZALO):
                ${best3.map(a => `- ${a.title} (${a.action_type}) -> Generó +$${a.profit_delta} de ganancia extra. (Nivel de Confianza de la Estrategia: ${a.confidence_score || 1}/10)`).join('\n')}
                
                Basado en estas acciones anteriores exitosas repetidas en este comercio, prioriza estrategias similares si el contexto actual lo permite.
                `;
            }

            // 4. Get API Key
            const { data: settingsData } = await supabase
                .from('settings')
                .select('value')
                .eq('key', 'google_api_key')
                .single();

            if (!settingsData?.value) {
                throw new Error("API Key de Gemini no configurada.");
            }

            // 5. Build and Send Prompt
            const prompt = `
            Eres el CFO y "Empire AI Coach" de "Digital Boost Empire".
            Analiza los siguientes datos financieros y de inventario de los últimos 30 días y devuelve ÚNICAMENTE un JSON válido con decisiones accionables.
            
            DATOS ACTUALES DEL NEGOCIO (ÚLTIMOS 30 DÍAS):
            ${JSON.stringify(aiPayload, null, 2)}
            
            ${feedbackContext}
            
            FORMATO REQUERIDO (Estrictamente JSON puro, sin markdown de bloques de código):
            {
              "missions": [
                {
                  "title": "Nombre de la misión o acción clara",
                  "impact": "high",
                  "reason": "Por qué debemos hacer esto",
                  "action_type": "restock",
                  "target_id": "nombre o id del objetivo"
                }
              ],
              "summary": "Mensaje motivacional (1 línea).",
              "urgency": "Estable",
              "urgencyReason": "Razón corta de la urgencia",
              "trendRadar": "Radar: Qué producto está en tendencia mundial",
              "trendScore": "87/100",
              "opportunityIndex": [
                { "product": "Nombre", "demand": "Alta", "opportunity": "🟢 Promocionar" }
              ],
              "strategyA": { "name": "ESTRATEGIA A", "plan": "Vende [X] con [Y]% OFF para liberar capital." },
              "strategyB": { 
                  "name": "ESTRATEGIA B", 
                  "plan": "Invierte tu dinero en X.",
                  "suggestedInvestment": "$32.000",
                  "suggestedStock": "18 unidades",
                  "estimatedMargin": "42%"
              },
              "prediction": "Predicción proactiva",
              "actionId": "create_promo",
              "actionText": "EJECUTAR PLAN"
            }`;

            let response;
            let retries = 3;
            let backoff = 1000; // start with 1s

            while (retries > 0) {
                response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${settingsData.value}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });

                if (response.status === 503 || response.status === 429) {
                    console.warn(`[EmpireAIService] Gemini API Overloaded (HTTP ${response.status}). Retries left: ${retries - 1}`);
                    retries--;
                    if (retries === 0) break;
                    await new Promise(r => setTimeout(r, backoff));
                    backoff *= 2; // exponential backoff
                } else {
                    break;
                }
            }

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Error HTTP ${response.status}: ${errText.substring(0, 150)}`);
            }
            
            const data = await response.json();
            let textReponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            
            // Clean markdown blocks
            textReponse = textReponse.replace(/```json/g, '').replace(/```/g, '').trim();
            
            const parsedInsights = JSON.parse(textReponse);
            
            // Log to Table (Pass the snapshot of metrics used to generate it)
            await EmpireAIService.logAIActions(parsedInsights.missions, {
                monthlyRevenue: aiPayload.metrics.monthlyRevenue,
                monthlyProfit: aiPayload.metrics.monthlyNetProfit
            });

            // Update Cache
            cachedResponse = parsedInsights;
            lastFetchTime = Date.now();
            
            return parsedInsights;

        } catch (error) {
            console.error("EmpireAIService Error:", error);
            // Fallback graceful
            return {
                missions: [],
                summary: "No pude analizar los datos en este momento. Revisa tu conexión o API Key.",
                error: true
            };
        }
    }
};
