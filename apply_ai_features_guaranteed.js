const fs = require('fs');
const content = fs.readFileSync('c:/Users/Guille/Downloads/DigitalBoostEmpire-app/src/screens/HomeScreen.js', 'utf8');
const lines = content.split('\n');

const startIdx = lines.findIndex(l => l.includes('            let prompt = `'));
const endIdx = lines.findIndex(l => l.includes('            const adviceJsonStr = await GeminiService.handleGeneralRequest(prompt);'));

const newPromptCode = \`            // 2. Build JSON Prompt
            let prompt = \\\`
            Eres el "Empire AI Coach", un asesor financiero y de mercado táctico de élite en "Digital Boost Empire".
            CONTEXTO: Tiendita de GADGETS COTIDIANOS y tecnología útil (novedades, accesorios).
            
            Analiza los datos y devuelve una ESTRATEGIA INMEDIATA formateada SOLO COMO UN OBJETO JSON válido (sin markdown).

            DATOS ACTUALES DEL NEGOCIO:
            - Nivel: \${empLevel}
            - Ventas Hoy: $\${stats.todaySales} (Tendencia: \${trend} del promedio semanal de $\${dailyAvg.toFixed(2)}/día)
            - Proyección Semanal: $\${stats.weekSales}
            - Inventario Crítico o Dormido: \${stats.lowStockCount} productos
            - Capital Retenido (Valor aprox): $\${stats.lockedCapital}
            
            TOP PRODUCTOS DE LA SEMANA:
            \${topProductsText}
            \\\`;

            if (customQuery) {
                prompt += \\\`
                SIMULADOR DE DECISIONES LANZADO: "\${customQuery}"
                Simula qué pasaría matemáticamente y lógicamente.
                \\\`;
            } else {
                prompt += \\\`
                INSTRUCCIONES CLAVE: 
                Calcula tiempo de recuperación de inversión (ROI en días). Considera la rotación de "Gadgets útiles".
                IMPORTANTE: Sugiere QUÉ NUEVOS PRODUCTOS DEBERÍA COMPRAR basándote en tendencias mundiales.
                \\\`;
            }

            prompt += \\\`
            Devuelve EXACTAMENTE este JSON con las claves exactas:
            {
              "empireLevel": "\${empLevel}",
              "urgency": "\${customQuery ? "Simulación" : "Estable"}" | "Atención" | "Crítico",
              "urgencyReason": "Razón del diagnóstico (ej: Tienes 18k parados en adaptadores obsoletos)",
              "trendRadar": "Radar mundial: Qué producto viral/novedoso está en tendencia mundial y deberías vender.",
              "opportunityIndex": [
                { "product": "Nombre Top seller", "demand": "Altiísima", "opportunity": "🟢 Promocionar" },
                { "product": "Producto estancado", "demand": "Baja", "opportunity": "🔴 Liquidar" },
                { "product": "Tendencia viral del radar descrita arriba", "demand": "Tendencia global", "opportunity": "🟡 Invertir capital" }
              ],
              "strategyA": {
                "name": "ESTRATEGIA A — LIQUIDAR",
                "plan": "Liquida [X estancado] con [X]% OFF. Recuperas $X en [X] días."
              },
              "strategyB": {
                "name": "ESTRATEGIA B — PIVOTAR",
                "plan": "Invierte tu dinero recuperado en [Tendencia viral]. Inversión de $X, ROI estimado en [X] días."
              },
              "prediction": "Proyección brutal de 1 sola frase (Ej: Si ejecutas ambas, sumas 30% de margen en 8 días).",
              "actionId": "create_promo" | "restock" | "close_budgets",
              "actionText": "\${customQuery ? "APLICAR ESTRATEGIA" : "EJECUTAR PLAN MAESTRO"}"
            }
            IMPORTANTE: Solo devuelve el JSON puro, nada de texto antes o después. Ningún markdown.
            \\\`;
\`;

if (startIdx !== -1 && endIdx !== -1) {
    lines.splice(startIdx - 1, endIdx - startIdx + 1, newPromptCode);
}

const uiStartIdx = lines.findIndex(l => l.includes('{/* Impact & Trend */}'));
const uiEndIdx = lines.findIndex((l, i) => i > uiStartIdx && l.includes('</View>')) + 20;

let realUiEndIdx = uiEndIdx;
for (let i = uiStartIdx; i < lines.length; i++) {
   if (lines[i].includes('{/* Action Action */}')) {
       realUiEndIdx = i - 1;
       break;
   }
}

const newUICode = \`                                {/* Trend Radar */}
                                {aiAdvice.trendRadar && (
                                    <View style={styles.trendRadarBox}>
                                        <MaterialCommunityIcons name="radar" size={24} color="#00ff88" />
                                        <Text style={styles.trendRadarText}>{aiAdvice.trendRadar}</Text>
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
                                            </View>
                                        )}
                                    </View>
                                )}

                                {/* Prediction */}
                                {aiAdvice.prediction && (
                                    <View style={styles.predictionBox}>
                                        <MaterialCommunityIcons name="crystal-ball" size={24} color="#9b59b6" />
                                        <Text style={styles.predictionText}>{aiAdvice.prediction}</Text>
                                    </View>
                                )}
\`;

if (uiStartIdx !== -1) {
    lines.splice(uiStartIdx, realUiEndIdx - uiStartIdx + 1, newUICode);
}

const cssStartIdx = lines.findIndex(l => l.includes('closeModalBtn: { backgroundColor: \\'#1a1a1a\\', padding: 15'));

const newCssCode = \`    // New Coach Components
    trendRadarBox: { flexDirection: 'row', backgroundColor: '#00ff8815', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#00ff8840', marginBottom: 15, gap: 10, alignItems: 'center' },
    trendRadarText: { color: '#00ff88', fontSize: 13, fontWeight: '800', flex: 1, lineHeight: 20, letterSpacing: 0.5 },
    tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 8, marginBottom: 8 },
    tableColTitle: { flex: 1, color: '#666', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
    tableRow: { flexDirection: 'row', marginBottom: 8, alignItems: 'center' },
    tableCell: { flex: 1, color: '#bbb', fontSize: 11, fontWeight: '500' },
    
    closeModalBtn: { backgroundColor: '#1a1a1a', padding: 15\`;

if(cssStartIdx !== -1) {
   lines[cssStartIdx] = newCssCode + lines[cssStartIdx].substring(lines[cssStartIdx].indexOf(', padding: 15') + 13);
}

fs.writeFileSync('c:/Users/Guille/Downloads/DigitalBoostEmpire-app/src/screens/HomeScreen.js', lines.join('\\n'));
console.log('Update Complete.');
