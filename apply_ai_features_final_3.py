import sys
import re

filepath = 'c:/Users/Guille/Downloads/DigitalBoostEmpire-app/src/screens/HomeScreen.js'
with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

# Update the JSON structure array in the prompt to include a trend score and specific investment recommendations
prompt_pattern = r"let prompt = `[\s\S]*?const adviceJsonStr = await GeminiService\.handleGeneralRequest\(prompt\);"

new_prompt = """let prompt = `
            Eres el "Empire AI Coach", un asesor financiero y táctico en "Digital Boost Empire".
            CONTEXTO: Tiendita de GADGETS COTIDIANOS (novedades, accesorios).
            
            Analiza los datos y devuelve una ESTRATEGIA INMEDIATA formateada SOLO COMO UN OBJETO JSON válido (sin markdown).

            DATOS ACTUALES DEL NEGOCIO (MONEDA: ARS PESOS ARGENTINOS):
            - Nivel: ${empLevel}
            - Ventas Hoy: $${stats.todaySales} (Tendencia: ${trend} del promedio semanal de $${dailyAvg.toFixed(2)}/día)
            - Ganancia Neta Hoy: $${stats.todayNetProfit?.toFixed(2)} (Si es negativo, gastó en stock/gastos más de lo que vendió)
            - Proyección Semanal: $${stats.weekSales}
            - Inventario Crítico o Dormido: ${stats.lowStockCount} productos
            - Capital Retenido (Valor aprox en $ARS): $${stats.lockedCapital}
            
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
                Sugiere QUÉ NUEVOS PRODUCTOS DEBERÍA COMPRAR basados en tendencia mundial, INCLUYENDO inversión sugerida.
                `;
            }

            prompt += `
            Debes devolver EXACTAMENTE este JSON:
            {
              "empireLevel": "${empLevel}",
              "urgency": "${customQuery ? "Simulación" : "Estable"}" | "Atención" | "Crítico",
              "urgencyReason": "Razón corta de la urgencia",
              "trendRadar": "Radar: Qué producto viral/novedoso está en tendencia mundial ahora mismo en gadgets y por qué.",
              "trendScore": "87/100",
              "opportunityIndex": [
                { "product": "Nombre Top seller", "demand": "Alta", "opportunity": "🟢 Promocionar" },
                { "product": "Producto estancado", "demand": "Baja", "opportunity": "🔴 Liquidar" },
                { "product": "Tendencia mundial (del radar)", "demand": "Novedad", "opportunity": "🟡 Invertir capital" }
              ],
              "strategyA": { "name": "ESTRATEGIA A — LIQUIDAR", "plan": "Vende [X] con [Y]% OFF para liberar $[Z] de capital en [W] días." },
              "strategyB": { 
                  "name": "ESTRATEGIA B — PIVOTAR", 
                  "plan": "Invierte tu dinero en [Producto Trend Radar].",
                  "suggestedInvestment": "$32.000",
                  "suggestedStock": "18 unidades",
                  "estimatedMargin": "42%"
              },
              "prediction": "Predicción brutal (Ej: Si aplicas el Pivot, la proyección sube a $42,000).",
              "actionId": "create_promo" | "restock" | "close_budgets",
              "actionText": "${customQuery ? "APLICAR ESTRATEGIA" : "EJECUTAR PLAN"}"
            }
            IMPORTANTE: Solo devuelve el JSON puro, nada de texto antes o después.
            `;

            const adviceJsonStr = await GeminiService.handleGeneralRequest(prompt);"""

code = re.sub(prompt_pattern, new_prompt, code)

# Update the UI to render the new fields
ui_pattern = r"\{/\* Trend Radar \*/\}[\s\S]*?\{/\* Prediction \*/\}"

new_ui = """{/* Trend Radar */}
                                {aiAdvice.trendRadar && (
                                    <View style={styles.trendRadarBox}>
                                        <MaterialCommunityIcons name="radar" size={24} color="#00ff88" />
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Text style={{ color: '#00ff88', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>RADAR GLOBAL</Text>
                                                {aiAdvice.trendScore && (
                                                    <View style={{ backgroundColor: '#00ff8820', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                                        <Text style={{ color: '#00ff88', fontSize: 10, fontWeight: '900' }}>🔥 {aiAdvice.trendScore}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={styles.trendRadarText}>{aiAdvice.trendRadar}</Text>
                                        </View>
                                    </View>
                                )}

                                {/* Opportunity Index Table */}
                                {aiAdvice.opportunityIndex && aiAdvice.opportunityIndex.length > 0 && (
                                    <View style={styles.coachCard}>
                                        <Text style={styles.planTitle}>ÍNDICE DE OPORTUNIDAD</Text>
                                        <View style={styles.tableHeader}>
                                            <Text style={[styles.tableColTitle, { flex: 2 }]}>Producto</Text>
                                            <Text style={styles.tableColTitle}>Demanda</Text>
                                            <Text style={styles.tableColTitle}>Nivel</Text>
                                        </View>
                                        {aiAdvice.opportunityIndex.map((row, idx) => (
                                            <View key={idx} style={styles.tableRow}>
                                                <Text style={[styles.tableCell, { flex: 2, color: '#fff' }]}>{row.product}</Text>
                                                <Text style={styles.tableCell}>{row.demand}</Text>
                                                <Text style={styles.tableCell}>{row.opportunity}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Strategies A & B */}
                                {(aiAdvice.strategyA || aiAdvice.strategyB) && (
                                    <View style={{ gap: 10, marginBottom: 20 }}>
                                        {aiAdvice.strategyA && (
                                            <View style={[styles.coachCard, { borderColor: '#e74c3c60', marginBottom: 0 }]}>
                                                <Text style={[styles.planTitle, { color: '#e74c3c' }]}>{aiAdvice.strategyA.name}</Text>
                                                <Text style={styles.planStep}>{aiAdvice.strategyA.plan}</Text>
                                            </View>
                                        )}
                                        <View style={{alignItems: 'center', marginVertical: -8, zIndex: 10}}>
                                            <View style={{backgroundColor: '#0a0a0a', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: '#333'}}>
                                                <Text style={{color: '#666', fontSize: 10, fontWeight: '900'}}>VS</Text>
                                            </View>
                                        </View>
                                        {aiAdvice.strategyB && (
                                            <View style={[styles.coachCard, { borderColor: '#3498db60', marginTop: 0, marginBottom: 0 }]}>
                                                <Text style={[styles.planTitle, { color: '#3498db' }]}>{aiAdvice.strategyB.name}</Text>
                                                <Text style={styles.planStep}>{aiAdvice.strategyB.plan}</Text>
                                                
                                                {/* Inversion Suggestion block */}
                                                {aiAdvice.strategyB.suggestedInvestment && (
                                                    <View style={{ marginTop: 15, padding: 12, backgroundColor: '#3498db15', borderRadius: 8, borderWidth: 1, borderColor: '#3498db30' }}>
                                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                                                            <Text style={{ color: '#888', fontSize: 10, fontWeight: '900' }}>INVERSIÓN SUGERIDA:</Text>
                                                            <Text style={{ color: '#3498db', fontSize: 11, fontWeight: '900' }}>{aiAdvice.strategyB.suggestedInvestment}</Text>
                                                        </View>
                                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                                                            <Text style={{ color: '#888', fontSize: 10, fontWeight: '900' }}>STOCK RECOMENDADO:</Text>
                                                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{aiAdvice.strategyB.suggestedStock}</Text>
                                                        </View>
                                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                            <Text style={{ color: '#888', fontSize: 10, fontWeight: '900' }}>MARGEN ESTIMADO:</Text>
                                                            <Text style={{ color: '#2ecc71', fontSize: 11, fontWeight: '900' }}>{aiAdvice.strategyB.estimatedMargin}</Text>
                                                        </View>
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                )}

                                {/* Prediction */}"""

code = re.sub(ui_pattern, new_ui, code)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)

print("Updates applied via Python.")
