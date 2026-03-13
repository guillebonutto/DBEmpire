const fs = require('fs');

const path = "c:/Users/Guille/Downloads/DigitalBoostEmpire-app/src/screens/HomeScreen.js";
let code = fs.readFileSync(path, 'utf8');

// The replacement code we want for generateAiInsights
const newLogic = \`    const generateAiInsights = async (customQuery = null) => {
        setIsAiLoading(true);
        if (!customQuery) setAiAdvice(null);
        try {
            // 1. Fetch Top Products sold this week to give AI context
            const now = new Date();
            const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            
            const { data: recentItems } = await supabase
                .from('sale_items')
                .select('quantity, products(name, current_stock, sale_price)')
                .gte('created_at', startOfWeek);

            const productStats = {};
            let topProductsText = "Aún no hay ventas esta semana.";

            if (recentItems && recentItems.length > 0) {
                recentItems.forEach(item => {
                    if (!item.products) return;
                    const name = item.products.name;
                    if (!productStats[name]) {
                        productStats[name] = { 
                            qty: 0, 
                            stock: item.products.current_stock || 0,
                            price: item.products.sale_price || 0
                        };
                    }
                    productStats[name].qty += item.quantity;
                });
                
                topProductsText = Object.entries(productStats)
                    .sort((a, b) => b[1].qty - a[1].qty)
                    .slice(0, 5)
                    .map(([name, data]) => \`- \${name}: \${data.qty} vendidos (Stock restante: \${data.stock}, Precio $\${data.price})\`)
                    .join('\\n');
            }

            const getEmpireLevel = (sales) => {
                if (sales < 1000) return 'Nivel 1: Emprendedor 🌱';
                if (sales < 5000) return 'Nivel 2: Comerciante 🏪';
                if (sales < 20000) return 'Nivel 3: Mercader 🚢';
                return 'Nivel 4: Imperio 👑';
            };

            const empLevel = getEmpireLevel(stats.monthSales);
            const dailyAvg = stats.weekSales / 7;
            const diffPct = dailyAvg > 0 ? (((stats.todaySales - dailyAvg) / dailyAvg) * 100).toFixed(0) : 0;
            const trend = diffPct > 0 ? \`+\${diffPct}% arriba\` : \`\${diffPct}% debajo\`;
            
            // 2. Build JSON Prompt
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
              "urgencyReason": "Razón del diagnóstico",
              "trendRadar": "Radar: Qué producto viral/novedoso está en tendencia mundial ahora mismo en gadgets y por qué.",
              "opportunityIndex": [
                { "product": "Top seller", "demand": "Alta", "opportunity": "🟢 Promocionar" },
                { "product": "Estancado", "demand": "Baja", "opportunity": "🔴 Liquidar" },
                { "product": "Novedad Viral", "demand": "Global", "opportunity": "🟡 Invertir capital" }
              ],
              "strategyA": {
                "name": "ESTRATEGIA A — LIQUIDAR",
                "plan": "Liquida [X estancado] con [X]% OFF. Recuperas $X en [X] días."
              },
              "strategyB": {
                "name": "ESTRATEGIA B — PIVOTAR",
                "plan": "Invierte tu dinero recuperado en [Tendencia viral]. Inversión de $X, ROI estimado en [X] días."
              },
              "prediction": "Proyección espectacular de 1 sola frase",
              "actionId": "create_promo" | "restock" | "close_budgets",
              "actionText": "\${customQuery ? "APLICAR ESTRATEGIA" : "EJECUTAR PLAN MAESTRO"}"
            }
            IMPORTANTE: Solo devuelve el JSON puro, sin tags de javascript o markdown.
            \\\`;

            const adviceJsonStr = await GeminiService.handleGeneralRequest(prompt);\`;

let lines = code.split('\\n');
let startIdx = lines.findIndex(l => l.includes('const generateAiInsights = async'));
let endIdx = lines.findIndex((l, i) => i > startIdx && l.includes('const adviceJsonStr = await GeminiService.handleGeneralRequest(prompt);'));

if (startIdx !== -1 && endIdx !== -1) {
    lines.splice(startIdx, endIdx - startIdx + 1, newLogic);
    code = lines.join('\\n');
} else {
    console.log("Could not find logic to replace");
}

// UI Replacement
const oldUIRegex = /\\{\\/\\* Impact & Trend \\*\\/\\}[\\s\\S]*?\\{\\/\\* Prediction \\*\\/\\}[\\s\\S]*?<View style=\\{styles\\.predictionBox\\}>[\\s\\S]*?<MaterialCommunityIcons name="crystal-ball" size=\\{24\\} color="#9b59b6" \\/>[\\s\\S]*?<Text style=\\{styles\\.predictionText\\}>\\{aiAdvice\\.prediction\\}<\\/Text>[\\s\\S]*?<\\/View>/m;

const newUI = \`{/* Trend Radar */}
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
                                )}\`;

if (oldUIRegex.test(code)) {
    code = code.replace(oldUIRegex, newUI);
} else {
    console.log("Could not find UI to replace");
}

let lines2 = code.split('\\n');
let stylesIdx = lines2.findIndex(l => l.includes('closeModalBtnText: { color: \\'#aaa\\', fontSize: 12'));
if (stylesIdx !== -1) {
    const newStylesBlock = \`
    // New Coach Components
    trendRadarBox: { flexDirection: 'row', backgroundColor: '#00ff8815', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#00ff8840', marginBottom: 15, gap: 10, alignItems: 'center' },
    trendRadarText: { color: '#00ff88', fontSize: 13, fontWeight: '800', flex: 1, lineHeight: 20, letterSpacing: 0.5 },
    tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 8, marginBottom: 8 },
    tableColTitle: { flex: 1, color: '#666', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
    tableRow: { flexDirection: 'row', marginBottom: 8, alignItems: 'center' },
    tableCell: { flex: 1, color: '#bbb', fontSize: 11, fontWeight: '500' },
    
    closeModalBtn: { backgroundColor: '#1a1a1a', padding: 15, borderRadius: 12, alignItems: 'center' },
    closeModalBtnText: { color: '#aaa', fontSize: 12, fontWeight: '900', letterSpacing: 1 }
\`;
    lines2.splice(stylesIdx - 1, 3, newStylesBlock);
    code = lines2.join('\\n');
}

fs.writeFileSync(path, code);
console.log('Update success');
