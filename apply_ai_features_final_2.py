import sys
import re

filepath = 'c:/Users/Guille/Downloads/DigitalBoostEmpire-app/src/screens/HomeScreen.js'
with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

# Using regex to replace the AI prompt code entirely between `let prompt = \`` and `const adviceJsonStr`
pattern = r"let prompt = `[\s\S]*?const adviceJsonStr = await GeminiService\.handleGeneralRequest\(prompt\);"

new_logic = """let prompt = `
            Eres el "Empire AI Coach", un asesor financiero y táctico en "Digital Boost Empire".
            CONTEXTO: Tiendita de GADGETS COTIDIANOS (novedades, accesorios).
            
            Analiza los datos y devuelve una ESTRATEGIA INMEDIATA formateada SOLO COMO UN OBJETO JSON válido (sin markdown).

            DATOS ACTUALES DEL NEGOCIO:
            - Nivel: ${empLevel}
            - Ventas Hoy: $${stats.todaySales} (Tendencia: ${trend} del promedio semanal de $${dailyAvg.toFixed(2)}/día)
            - Proyección Semanal: $${stats.weekSales}
            - Inventario Crítico o Dormido: ${stats.lowStockCount} productos
            - Capital Retenido (Valor aprox): $${stats.lockedCapital}
            
            TOP PRODUCTOS DE LA SEMANA:
            ${topProductsText}
            `;

            if (customQuery) {
                prompt += `
                SIMULADOR DE DECISIONES LANZADO: "${customQuery}"
                Simula matemáticamente qué pasaría. Muestra ROI estimado.
                `;
            } else {
                prompt += `
                INSTRUCCIONES CLAVE:
                Da una estrategia de Liquidar vs Pivotar. Calcula tiempo de recuperación de inversión (ROI en días).
                Sugiere QUÉ NUEVOS PRODUCTOS DEBERÍA COMPRAR basados en tendencia mundial.
                `;
            }

            prompt += `
            Debes devolver EXACTAMENTE este JSON:
            {
              "empireLevel": "${empLevel}",
              "urgency": "${customQuery ? "Simulación" : "Estable"}" | "Atención" | "Crítico",
              "urgencyReason": "Razón corta de la urgencia",
              "trendRadar": "Radar: Qué producto viral/novedoso está en tendencia mundial ahora mismo en gadgets y por qué.",
              "opportunityIndex": [
                { "product": "Nombre Top seller", "demand": "Alta", "opportunity": "🟢 Promocionar" },
                { "product": "Producto estancado", "demand": "Baja", "opportunity": "🔴 Liquidar" },
                { "product": "Tendencia mundial (del radar)", "demand": "Novedad", "opportunity": "🟡 Invertir capital" }
              ],
              "strategyA": { "name": "ESTRATEGIA A — LIQUIDAR", "plan": "Vende [X] con [Y]% OFF para liberar $[Z] de capital en [W] días." },
              "strategyB": { "name": "ESTRATEGIA B — PIVOTAR", "plan": "Invierte tu dinero en [Producto Trend Radar]. ROI estimado: [W] días." },
              "prediction": "Predicción brutal (Ej: Si aplicas el Pivot, la proyección sube a $42,000).",
              "actionId": "create_promo" | "restock" | "close_budgets",
              "actionText": "${customQuery ? "APLICAR ESTRATEGIA" : "EJECUTAR PLAN"}"
            }
            IMPORTANTE: Solo devuelve el JSON puro, nada de texto antes o después.
            `;

            const adviceJsonStr = await GeminiService.handleGeneralRequest(prompt);"""

code = re.sub(pattern, new_logic, code)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)

print("Prompt regex replacement complete.")
