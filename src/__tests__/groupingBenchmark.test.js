const { performance } = require('perf_hooks');

function calcStats(samples) {
    const sorted = [...samples].sort((a, b) => a - b);
    const n = sorted.length;
    const mean = samples.reduce((acc, v) => acc + v, 0) / n;
    const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
    const min = sorted[0];
    const max = sorted[n - 1];
    const p95 = sorted[Math.min(Math.floor(n * 0.95), n - 1)];
    const variance = samples.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    return { mean, median, min, max, p95, stdDev };
}

describe('Rigorous Performance Benchmarks (Before & After)', () => {
    // ── BENCHMARK 1: Standard Grouping (1,000 Sales, 5,000 Line Items) ─────────
    test('Benchmark 1: O(S * I) Nested Filter vs O(S + I) Hash Grouping (1000 sales, 5000 items)', () => {
        const S = 1000;
        const I = 5000;
        const sales = Array.from({ length: S }, (_, i) => ({ id: `sale_${i}`, total_amount: 1500 }));
        const saleItems = Array.from({ length: I }, (_, i) => ({
            id: `item_${i}`,
            sale_id: `sale_${i % S}`,
            product_id: `prod_${i % 50}`,
            quantity: 2,
            subtotal: 1000
        }));
        const prodMap = Array.from({ length: 50 }, (_, i) => ({ id: `prod_${i}`, name: `Prod ${i}` }))
            .reduce((acc, p) => ({ ...acc, [p.id]: p }), {});

        const iterations = 30;

        // Warmup
        for (let w = 0; w < 5; w++) {
            sales.map(s => ({ ...s, sale_items: saleItems.filter(it => it.sale_id === s.id) }));
        }

        // Measure Nested Filter (Before)
        const nestedSamples = [];
        for (let it = 0; it < iterations; it++) {
            const t0 = performance.now();
            const enriched = sales.map(s => {
                const items = saleItems.filter(item => item.sale_id === s.id).map(item => ({
                    ...item,
                    products: prodMap[item.product_id] || { name: 'Producto' }
                }));
                return { ...s, sale_items: items };
            });
            const t1 = performance.now();
            nestedSamples.push(t1 - t0);
        }

        // Warmup Hash Grouping
        for (let w = 0; w < 5; w++) {
            const map = {};
            for (let i = 0; i < saleItems.length; i++) {
                const it = saleItems[i];
                if (!map[it.sale_id]) map[it.sale_id] = [];
                map[it.sale_id].push(it);
            }
        }

        // Measure Hash Grouping (After)
        const hashSamples = [];
        for (let it = 0; it < iterations; it++) {
            const t0 = performance.now();
            const itemsBySale = {};
            for (let i = 0; i < saleItems.length; i++) {
                const it = saleItems[i];
                if (!itemsBySale[it.sale_id]) itemsBySale[it.sale_id] = [];
                itemsBySale[it.sale_id].push({
                    ...it,
                    products: prodMap[it.product_id] || { name: 'Producto' }
                });
            }
            const enriched = sales.map(s => ({
                ...s,
                sale_items: itemsBySale[s.id] || []
            }));
            const t1 = performance.now();
            hashSamples.push(t1 - t0);
        }

        const nestedStats = calcStats(nestedSamples);
        const hashStats = calcStats(hashSamples);

        console.log('\n======================================================');
        console.log(`[BENCHMARK 1] Standard Dataset: ${S} sales, ${I} sale_items`);
        console.log(`Nested Filter O(S*I) -> Median: ${nestedStats.median.toFixed(3)} ms | Mean: ${nestedStats.mean.toFixed(3)} ms | StdDev: ${nestedStats.stdDev.toFixed(3)} ms | p95: ${nestedStats.p95.toFixed(3)} ms`);
        console.log(`Hash Grouping O(S+I) -> Median: ${hashStats.median.toFixed(3)} ms | Mean: ${hashStats.mean.toFixed(3)} ms | StdDev: ${hashStats.stdDev.toFixed(3)} ms | p95: ${hashStats.p95.toFixed(3)} ms`);
        console.log(`Median Speedup: ${(nestedStats.median / hashStats.median).toFixed(1)}x faster`);
        console.log('======================================================');

        expect(hashStats.median).toBeLessThan(nestedStats.median);
    });

    // ── BENCHMARK 2: Edge Cases (Sales without items, orphans, preloaded) ─────
    test('Benchmark 2: Edge Cases Dataset (1000 sales, 500 no items, 500 orphans, 100 preloaded)', () => {
        const S = 1000;
        const prodMap = { p1: { name: 'P1' } };

        const sales = Array.from({ length: S }, (_, i) => {
            if (i < 100) {
                // Preloaded items
                return { id: `sale_${i}`, sale_items: [{ id: `pre_${i}`, product_id: 'p1' }] };
            }
            return { id: `sale_${i}` };
        });

        // 2,000 items: 1,500 belonging to sales 100-500, and 500 orphan items
        const saleItems = [];
        for (let i = 0; i < 1500; i++) {
            const targetSale = 100 + (i % 400);
            saleItems.push({ id: `item_${i}`, sale_id: `sale_${targetSale}`, product_id: 'p1' });
        }
        for (let i = 0; i < 500; i++) {
            saleItems.push({ id: `orphan_${i}`, sale_id: `non_existent_${i}`, product_id: 'p1' });
        }

        const iterations = 30;

        // Nested filter
        const nestedSamples = [];
        for (let it = 0; it < iterations; it++) {
            const t0 = performance.now();
            const enriched = sales.map(s => {
                if (Array.isArray(s.sale_items) && s.sale_items.length > 0) return s;
                const items = saleItems.filter(item => item.sale_id === s.id).map(item => ({
                    ...item,
                    products: prodMap[item.product_id] || { name: 'Producto' }
                }));
                return { ...s, sale_items: items };
            });
            const t1 = performance.now();
            nestedSamples.push(t1 - t0);
        }

        // Hash grouping
        const hashSamples = [];
        for (let it = 0; it < iterations; it++) {
            const t0 = performance.now();
            const itemsBySale = {};
            for (let i = 0; i < saleItems.length; i++) {
                const it = saleItems[i];
                if (!itemsBySale[it.sale_id]) itemsBySale[it.sale_id] = [];
                itemsBySale[it.sale_id].push({
                    ...it,
                    products: prodMap[it.product_id] || { name: 'Producto' }
                });
            }
            const enriched = sales.map(s => {
                if (Array.isArray(s.sale_items) && s.sale_items.length > 0) return s;
                return { ...s, sale_items: itemsBySale[s.id] || [] };
            });
            const t1 = performance.now();
            hashSamples.push(t1 - t0);
        }

        const nestedStats = calcStats(nestedSamples);
        const hashStats = calcStats(hashSamples);

        console.log('\n======================================================');
        console.log(`[BENCHMARK 2] Edge Case Dataset (Preloaded, Empty, Orphans)`);
        console.log(`Nested Filter O(S*I) -> Median: ${nestedStats.median.toFixed(3)} ms | Mean: ${nestedStats.mean.toFixed(3)} ms | StdDev: ${nestedStats.stdDev.toFixed(3)} ms | p95: ${nestedStats.p95.toFixed(3)} ms`);
        console.log(`Hash Grouping O(S+I) -> Median: ${hashStats.median.toFixed(3)} ms | Mean: ${hashStats.mean.toFixed(3)} ms | StdDev: ${hashStats.stdDev.toFixed(3)} ms | p95: ${hashStats.p95.toFixed(3)} ms`);
        console.log(`Median Speedup: ${(nestedStats.median / hashStats.median).toFixed(1)}x faster`);
        console.log('======================================================');

        expect(hashStats.median).toBeLessThan(nestedStats.median);
    });

    // ── BENCHMARK 3: Index Construction vs. Lookups (Isolated & Amortized) ─
    test('Benchmark 3: Index Build vs Single and Multiple Lookups (N = 3,000)', () => {
        const N = 3000;
        const sales = Array.from({ length: N }, (_, i) => ({ id: `sale_${i}`, status: 'pending' }));
        const targetId = `sale_${N - 5}`; // Worst case near end of array
        const iterations = 500;

        // 1. Measure Index Construction alone
        const buildSamples = [];
        for (let it = 0; it < iterations; it++) {
            const t0 = performance.now();
            const map = new Map();
            for (let i = 0; i < sales.length; i++) {
                map.set(sales[i].id, sales[i]);
            }
            const t1 = performance.now();
            buildSamples.push(t1 - t0);
        }

        // Prebuilt index for query tests
        const salesMap = new Map();
        for (let i = 0; i < sales.length; i++) {
            salesMap.set(sales[i].id, sales[i]);
        }

        // 2. Measure Single Isolated Linear Scan (N = 3,000)
        const singleLinearSamples = [];
        for (let it = 0; it < iterations; it++) {
            const t0 = performance.now();
            const found = sales.find(s => s.id === targetId);
            const t1 = performance.now();
            singleLinearSamples.push(t1 - t0);
        }

        // 3. Measure Single Lookup on Prebuilt Index (O(1))
        const singleMapSamples = [];
        for (let it = 0; it < iterations; it++) {
            const t0 = performance.now();
            const found = salesMap.get(targetId);
            const t1 = performance.now();
            singleMapSamples.push(t1 - t0);
        }

        // 3b. Measure Isolated Single Search (Build Index + Single Query)
        const isolatedBuildAndQuerySamples = [];
        for (let it = 0; it < iterations; it++) {
            const t0 = performance.now();
            const tempMap = new Map();
            for (let i = 0; i < sales.length; i++) {
                tempMap.set(sales[i].id, sales[i]);
            }
            const found = tempMap.get(targetId);
            const t1 = performance.now();
            isolatedBuildAndQuerySamples.push(t1 - t0);
        }
        const isolatedBuildAndQueryStats = calcStats(isolatedBuildAndQuerySamples);

        // 4. Measure Multiple Lookups (M = 100 queries) Linear vs Prebuilt Index
        const M = 100;
        const queryIds = Array.from({ length: M }, (_, i) => `sale_${(i * 29) % N}`);

        const multiLinearSamples = [];
        for (let it = 0; it < 50; it++) {
            const t0 = performance.now();
            for (let q = 0; q < M; q++) {
                const qId = queryIds[q];
                const found = sales.find(s => s.id === qId);
            }
            const t1 = performance.now();
            multiLinearSamples.push(t1 - t0);
        }

        const multiMapSamples = [];
        for (let it = 0; it < 50; it++) {
            const t0 = performance.now();
            for (let q = 0; q < M; q++) {
                const qId = queryIds[q];
                const found = salesMap.get(qId);
            }
            const t1 = performance.now();
            multiMapSamples.push(t1 - t0);
        }

        const buildStats = calcStats(buildSamples);
        const singleLinearStats = calcStats(singleLinearSamples);
        const singleMapStats = calcStats(singleMapSamples);
        const multiLinearStats = calcStats(multiLinearSamples);
        const multiMapStats = calcStats(multiMapSamples);

        console.log('\n======================================================');
        console.log(`[BENCHMARK 3] Index Construction vs Queries (N = ${N} items)`);
        console.log(`Index Construction (Build Map)    -> Median: ${(buildStats.median * 1000).toFixed(1)} µs | Mean: ${(buildStats.mean * 1000).toFixed(1)} µs | StdDev: ${(buildStats.stdDev * 1000).toFixed(1)} µs | p95: ${(buildStats.p95 * 1000).toFixed(1)} µs`);
        console.log(`Single Linear Scan find()         -> Median: ${(singleLinearStats.median * 1000).toFixed(1)} µs | Mean: ${(singleLinearStats.mean * 1000).toFixed(1)} µs | StdDev: ${(singleLinearStats.stdDev * 1000).toFixed(1)} µs | p95: ${(singleLinearStats.p95 * 1000).toFixed(1)} µs`);
        console.log(`Isolated (Build Index + Find 1)   -> Median: ${(isolatedBuildAndQueryStats.median * 1000).toFixed(1)} µs | Mean: ${(isolatedBuildAndQueryStats.mean * 1000).toFixed(1)} µs | StdDev: ${(isolatedBuildAndQueryStats.stdDev * 1000).toFixed(1)} µs | p95: ${(isolatedBuildAndQueryStats.p95 * 1000).toFixed(1)} µs`);
        console.log(`Single Map.get() on Prebuilt Idx  -> Median: ${(singleMapStats.median * 1000).toFixed(1)} µs | Mean: ${(singleMapStats.mean * 1000).toFixed(1)} µs | StdDev: ${(singleMapStats.stdDev * 1000).toFixed(1)} µs | p95: ${(singleMapStats.p95 * 1000).toFixed(1)} µs`);
        console.log(`Prebuilt Lookup Speedup vs Linear: ${(singleLinearStats.median / singleMapStats.median).toFixed(1)}x`);
        console.log(`* Note: For an isolated single query, Linear Scan is ${(isolatedBuildAndQueryStats.median / singleLinearStats.median).toFixed(1)}x faster than Building a Map + Querying.`);
        console.log(`--- Multiple Queries (M = ${M} lookups) ---`);
        console.log(`100x Linear Scans O(M * N)     -> Median: ${multiLinearStats.median.toFixed(3)} ms | p95: ${multiLinearStats.p95.toFixed(3)} ms | StdDev: ${multiLinearStats.stdDev.toFixed(3)} ms`);
        console.log(`100x Map Lookups O(M * 1)      -> Median: ${multiMapStats.median.toFixed(3)} ms | p95: ${multiMapStats.p95.toFixed(3)} ms | StdDev: ${multiMapStats.stdDev.toFixed(3)} ms`);
        console.log(`Multi-Query Speedup: ${(multiLinearStats.median / multiMapStats.median).toFixed(1)}x`);
        console.log('======================================================');

        expect(singleMapStats.median).toBeLessThan(singleLinearStats.median);
        expect(multiMapStats.median).toBeLessThan(multiLinearStats.median);
    });

    // ── BENCHMARK 4: Inactive Clients CRM Calculation (O(N*M) vs O(N) Set) ────
    test('Benchmark 4: Inactive Clients Derivation (1,000 clients, 5,000 sales)', () => {
        const C = 1000;
        const S = 5000;
        const clients = Array.from({ length: C }, (_, i) => ({ id: `client_${i}`, name: `Client ${i}` }));
        const threshold = Date.now() - (30 * 24 * 3600 * 1000);
        const sales = Array.from({ length: S }, (_, i) => ({
            id: `sale_${i}`,
            client_id: `client_${i % C}`,
            created_at: new Date(Date.now() - (i % 60) * 24 * 3600 * 1000).toISOString()
        }));

        const threshIso = new Date(threshold).toISOString();
        const iterations = 30;

        // Naive O(C * S) nested check
        const naiveSamples = [];
        for (let it = 0; it < iterations; it++) {
            const t0 = performance.now();
            const inactive = clients.filter(c => {
                const hasRecent = sales.some(s => s.client_id === c.id && s.created_at > threshIso);
                return !hasRecent;
            });
            const t1 = performance.now();
            naiveSamples.push(t1 - t0);
        }

        // Optimized O(C + S) Set filter
        const setSamples = [];
        for (let it = 0; it < iterations; it++) {
            const t0 = performance.now();
            const activeIds = new Set();
            for (let i = 0; i < sales.length; i++) {
                const s = sales[i];
                if (s.created_at > threshIso) {
                    activeIds.add(s.client_id);
                }
            }
            const inactive = clients.filter(c => !activeIds.has(c.id));
            const t1 = performance.now();
            setSamples.push(t1 - t0);
        }

        const naiveStats = calcStats(naiveSamples);
        const setStats = calcStats(setSamples);

        console.log('\n======================================================');
        console.log(`[BENCHMARK 4] Inactive CRM Derivation (${C} clients, ${S} sales)`);
        console.log(`Naive O(C * S) -> Median: ${naiveStats.median.toFixed(3)} ms | Mean: ${naiveStats.mean.toFixed(3)} ms | StdDev: ${naiveStats.stdDev.toFixed(3)} ms | p95: ${naiveStats.p95.toFixed(3)} ms`);
        console.log(`Set O(C + S)   -> Median: ${setStats.median.toFixed(3)} ms | Mean: ${setStats.mean.toFixed(3)} ms | StdDev: ${setStats.stdDev.toFixed(3)} ms | p95: ${setStats.p95.toFixed(3)} ms`);
        console.log(`Median Speedup: ${(naiveStats.median / setStats.median).toFixed(1)}x faster`);
        console.log('======================================================\n');

        expect(setStats.median).toBeLessThan(naiveStats.median);
    });
});
