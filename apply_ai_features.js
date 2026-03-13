const fs = require('fs');
const filePath = 'c:/Users/Guille/Downloads/DigitalBoostEmpire-app/src/screens/HomeScreen.js';
let content = fs.readFileSync(filePath, 'utf8');

const oldPrompt = \`            let prompt = \\\`
            Eres el "Empire AI Coach", un asesor táctico de élite integrado en "Digital Boost Empire" (App de punto de venta).
            CONTEXTO DEL NEGOCIO: Es una tiendita/emprendimiento dedicado a vender GADGETS PARA EL USO COTIDIANO, artículos prácticos, curiosos y tecnología útil para el día a día (novedades, accesorios hogar/oficina, etc.).
            Tu objetivo es generar estrategias de alta rotación, armar combos estratégicos, detectar "capital dormido" y SUGERIR NUEVOS PRODUCTOS.
            
            Analiza los datos y devuelve una ESTRATEGIA INMEDIATA formateada SOLO COMO UN OBJETO JSON válido (sin código markdown \\\\\\`\\\\\\`\\\\\\`json).

            DATOS ACTUALES DEL NEGOCIO:
            - Nivel del Imperio: \${empLevel}
            - Rol: \${userRole === 'admin' ? 'Admin' : 'Vendedor'}
            - Ventas Hoy: $\${stats.todaySales} (Tendencia: \${trend} del promedio semanal de $\${dailyAvg.toFixed(2)}/día)
            - Proyección Semanal Actual: $\${stats.weekSales}
            - Inventario Crítico o Dormido: \${stats.lowStockCount} productos
            - Capital Retenido (Valor aprox): $\${stats.lockedCapital}
            
            TOP PRODUCTOS DE LA SEMANA:
            \${topProductsText}
            \\\`;

            if (customQuery) {
                prompt += \\\`
                ATENCIÓN: EL USUARIO HA LANZADO EL SIMULADOR DE DECISIONES CON ESTA PREGUNTA: "\${customQuery}"
                Debes responder ESPECÍFICAMENTE simulando matemáticamente y logísticamente qué pasaría si hace eso.
                Calcula si mantiene márgenes, cuánto capital compromete, o cuántas unidades extra tiene que vender.
                \\\`;
            } else {
                prompt += \\\`
                INSTRUCCIONES PARA EL DIAGNÓSTICO LIBRE:
                Detecta oportunidades ocultas. Si hay productos estrella sin stock, sugiere reponer.
                IMPORTANTE: Analiza su historial y el nicho para sugerir QUÉ NUEVOS PRODUCTOS DEBERÍA COMPRAR mañana para expandir su catálogo (productos de tendencia o complementarios que aún no tiene pero que sus clientes comprarían).
                Si hay capital bloqueado, sugiere crear "Combos Relámpago". 
                \\\`;
            }

            prompt += \\\`
            Debes devolver EXACTAMENTE este objeto JSON con las claves exactas (reemplaza los valores con tu análisis de alto impacto enfocado en tecnología/accesorios):
            {
              "empireLevel": "\${empLevel}",
              "urgency": "\${customQuery ? "Simulación" : "Estable"}" | "Atención" | "Crítico",
              "urgencyReason": "\${customQuery ? "Resultado simulado en proceso..." : "Razón corta de la urgencia (ej: 'Tienes 18k retenidos en capital muerto. Usa combos para accesorios.')"}",
              "impact": "Explica el impacto en dinero (ej: 'Si reduces un 10%, necesitas vender 3 fundas extra para mantener ganancia.')",
              "trend": "Comparación temporal o análisis de mercado tech (ej: 'Tus cables USB-C bajaron rotación. Combínalos con cargadores.')",
              "prediction": "Predicción financiera brutal (ej: 'Si inviertes $5,000 extra en los top 2 gadgets hoy, la proyección de la semana se dispara a $42,000 en ventas.')",
              "plan": [
                "1️⃣ Acción específica (Ej: 'Crea Combo Cargador+Cable 15% OFF')",
                "2️⃣ Segunda acción concreta"
              ],
              "actionId": "create_promo" | "restock" | "close_budgets",
              "actionText": "\${customQuery ? "APLICAR ESTRATEGIA" : "CREAR COMBO O REPONER"}"
            }
            IMPORTANTE: Solo devuelve el JSON puro, nada de texto antes o después.
            \\\`;\`;

const newPrompt = \`            let prompt = \\\`
            Eres el "Empire AI Coach", un asesor financiero y táctico en "Digital Boost Empire".
            CONTEXTO: Tiendita de GADGETS COTIDIANOS (novedades, accesorios).
            
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
                Simula matemáticamente qué pasaría.
                \\\`;
            } else {
                prompt += \\\`
                INSTRUCCIONES CLAVE:
                Da una estrategia de Liquidar vs Pivotar. Calcula tiempo de recuperación de inversión (ROI en días).
                Sugiere QUÉ NUEVOS PRODUCTOS DEBERÍA COMPRAR basados en tendencia mundial.
                \\\`;
            }

            prompt += \\\`
            Debes devolver EXACTAMENTE este JSON:
            {
              "empireLevel": "\${empLevel}",
              "urgency": "\${customQuery ? "Simulación" : "Estable"}" | "Atención" | "Crítico",
              "urgencyReason": "Razón corta de la urgencia",
              "trendRadar": "Radar: Qué producto viral/novedoso está en tendencia mundial ahora mismo en gadgets y por qué.",
              "opportunityIndex": [
                { "product": "Nombre Top seller", "demand": "Alta", "opportunity": "🟢 muy buena" },
                { "product": "Producto estancado", "demand": "Baja", "opportunity": "🔴 liquidar" },
                { "product": "Tendencia mundial (del radar)", "demand": "Novedad", "opportunity": "🟡 oportunidad" }
              ],
              "strategyA": { "name": "ESTRATEGIA A — LIQUIDAR", "plan": "Vende [X] con [Y]% OFF para liberar $[Z] de capital en [W] días." },
              "strategyB": { "name": "ESTRATEGIA B — PIVOTAR", "plan": "Invierte capital en [Producto Trend Radar]. ROI estimado: [W] días." },
              "prediction": "Predicción brutal (Ej: Si aplicas el Pivot, la proyección sube a $42,000).",
              "actionId": "create_promo" | "restock" | "close_budgets",
              "actionText": "\${customQuery ? "APLICAR ESTRATEGIA" : "EJECUTAR PLAN"}"
            }
            IMPORTANTE: Solo devuelve el JSON puro, nada de texto antes o después.
            \\\`;\`;

const oldUI = \`                                {/* Impact & Trend */}
                                <View style={styles.coachCard}>
                                    <View style={styles.coachCardRow}>
                                        <MaterialCommunityIcons name="chart-bell-curve-cumulative" size={20} color="#d4af37" />
                                        <Text style={styles.coachCardText}>{aiAdvice.trend}</Text>
                                    </View>
                                    <View style={[styles.coachCardRow, { marginTop: 10, borderTopWidth: 1, borderTopColor: '#222', paddingTop: 10 }]}>
                                        <MaterialCommunityIcons name="currency-usd" size={20} color="#2ecc71" />
                                        <Text style={styles.coachCardText}>{aiAdvice.impact}</Text>
                                    </View>
                                </View>

                                {/* Priority Plan */}
                                <View style={styles.coachCard}>
                                    <Text style={styles.planTitle}>PLAN TÁCTICO INMEDIATO</Text>
                                    {aiAdvice.plan && aiAdvice.plan.map((step, idx) => (
                                        <Text key={idx} style={styles.planStep}>{step}</Text>
                                    ))}
                                </View>

                                {/* Prediction */}
                                <View style={styles.predictionBox}>
                                    <MaterialCommunityIcons name="crystal-ball" size={24} color="#9b59b6" />
                                    <Text style={styles.predictionText}>{aiAdvice.prediction}</Text>
                                </View>\`;

const newUI = \`                                {/* Trend Radar */}
                                {aiAdvice.trendRadar && (
                                    <View style={styles.trendRadarBox}>
                                        <MaterialCommunityIcons name="radar" size={20} color="#00ff88" />
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
                                )}\`;

const oldStyles = 'closeModalBtnText: { color: \\'#aaa\\', fontSize: 12, fontWeight: \\'900\\', letterSpacing: 1 }';
const newStyles = \`closeModalBtnText: { color: '#aaa', fontSize: 12, fontWeight: '900', letterSpacing: 1 },

    trendRadarBox: { flexDirection: 'row', backgroundColor: '#00ff8815', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#00ff8840', marginBottom: 15, gap: 10, alignItems: 'center' },
    trendRadarText: { color: '#00ff88', fontSize: 13, fontWeight: '800', flex: 1, lineHeight: 20, letterSpacing: 0.5 },
    tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 8, marginBottom: 8 },
    tableColTitle: { flex: 1, color: '#666', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
    tableRow: { flexDirection: 'row', marginBottom: 8, alignItems: 'center' },
    tableCell: { flex: 1, color: '#bbb', fontSize: 11, fontWeight: '500' }\`;

content = content.replace(oldPrompt, newPrompt);
content = content.replace(oldUI, newUI);
content = content.replace(oldStyles, newStyles);

fs.writeFileSync(filePath, content);
console.log('Done refactoring advanced AI features.');
