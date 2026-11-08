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

describe('Priority 4: Queue Drain Synthetic Benchmark (100, 500, 1,000 Operations)', () => {
    /**
     * Simulates sequential drain of pending_sync queue under controlled parameters:
     * - Preserves FIFO sequence per product (no dangerous parallel stock mutations)
     * - Separates:
     *    1) Local DB & serialization overhead (localTime)
     *    2) Simulated network RTT (networkTime, e.g. 2ms per request in micro-bench)
     *    3) Simulated network retry latency (retryTime on 5% failure rate)
     *    4) Total elapsed time
     */
    async function simulateQueueDrain({ opCount, simulatedRttMs = 1, failureRate = 0.05 }) {
        const queue = Array.from({ length: opCount }, (_, i) => ({
            id: i + 1,
            table_name: i % 2 === 0 ? 'sales' : 'expenses',
            action: 'INSERT',
            payload: JSON.stringify({
                id: `op_${i}`,
                product_id: `prod_${i % 10}`,
                amount: 1000 + i,
                qty: 1
            }),
            metadata: JSON.stringify({
                items: [{ id: `prod_${i % 10}`, qty: 1 }]
            })
        }));

        let localTimeMs = 0;
        let networkTimeMs = 0;
        let retryTimeMs = 0;
        let retriesCount = 0;

        const totalStart = performance.now();

        // Sequential FIFO drain to ensure consistency on shared product stock
        for (let i = 0; i < queue.length; i++) {
            const item = queue[i];

            // 1. Local parsing & processing
            const tLocal0 = performance.now();
            const payload = JSON.parse(item.payload);
            const metadata = JSON.parse(item.metadata);
            const stableId = `${payload.id}_processed`;
            const tLocal1 = performance.now();
            localTimeMs += (tLocal1 - tLocal0);

            // 2. Simulated remote network round-trip
            const tNet0 = performance.now();
            // Busy-wait / spin simulation of network latency without setTimeout skew in tests
            const endNet = performance.now() + simulatedRttMs;
            while (performance.now() < endNet) {}
            const tNet1 = performance.now();
            networkTimeMs += (tNet1 - tNet0);

            // 3. Simulated transient failure & retry
            // Deterministic pseudo-random failure condition for 5% of ops
            if ((i * 37) % 100 < failureRate * 100) {
                retriesCount++;
                const tRet0 = performance.now();
                const endRet = performance.now() + (simulatedRttMs * 1.5);
                while (performance.now() < endRet) {}
                const tRet1 = performance.now();
                retryTimeMs += (tRet1 - tRet0);
            }

            // 4. Local cleanup (remove from queue simulation)
            const tClean0 = performance.now();
            const removedId = item.id;
            const tClean1 = performance.now();
            localTimeMs += (tClean1 - tClean0);
        }

        const totalEnd = performance.now();
        const totalDurationMs = totalEnd - totalStart;

        return {
            opCount,
            totalDurationMs,
            localTimeMs,
            networkTimeMs,
            retryTimeMs,
            retriesCount,
            throughputOpsSec: (opCount / (totalDurationMs / 1000))
        };
    }

    test('Synthetic Drain Benchmark: 100 Operations', async () => {
        const runs = 5;
        const results = [];
        for (let r = 0; r < runs; r++) {
            results.push(await simulateQueueDrain({ opCount: 100, simulatedRttMs: 0.5, failureRate: 0.05 }));
        }

        const totalStats = calcStats(results.map(r => r.totalDurationMs));
        const localStats = calcStats(results.map(r => r.localTimeMs));
        const netStats = calcStats(results.map(r => r.networkTimeMs));
        const retryStats = calcStats(results.map(r => r.retryTimeMs));

        console.log('\n======================================================');
        console.log(`[QUEUE DRAIN BENCHMARK: 100 Operations]`);
        console.log(`Local Processing Time  -> Median: ${localStats.median.toFixed(2)} ms | Mean: ${localStats.mean.toFixed(2)} ms | p95: ${localStats.p95.toFixed(2)} ms | StdDev: ${localStats.stdDev.toFixed(2)} ms`);
        console.log(`Simulated Network Time -> Median: ${netStats.median.toFixed(2)} ms | Mean: ${netStats.mean.toFixed(2)} ms | p95: ${netStats.p95.toFixed(2)} ms | StdDev: ${netStats.stdDev.toFixed(2)} ms`);
        console.log(`Retry Latency (5% err) -> Median: ${retryStats.median.toFixed(2)} ms | Mean: ${retryStats.mean.toFixed(2)} ms | p95: ${retryStats.p95.toFixed(2)} ms | StdDev: ${retryStats.stdDev.toFixed(2)} ms`);
        console.log(`Total Drain Time       -> Median: ${totalStats.median.toFixed(2)} ms | Mean: ${totalStats.mean.toFixed(2)} ms | p95: ${totalStats.p95.toFixed(2)} ms | StdDev: ${totalStats.stdDev.toFixed(2)} ms`);
        console.log(`Effective Throughput   -> ${(100 / (totalStats.median / 1000)).toFixed(1)} ops/sec`);
        console.log('======================================================');

        expect(totalStats.median).toBeGreaterThan(0);
        expect(localStats.median).toBeLessThan(totalStats.median);
    });

    test('Synthetic Drain Benchmark: 500 Operations', async () => {
        const runs = 3;
        const results = [];
        for (let r = 0; r < runs; r++) {
            results.push(await simulateQueueDrain({ opCount: 500, simulatedRttMs: 0.5, failureRate: 0.05 }));
        }

        const totalStats = calcStats(results.map(r => r.totalDurationMs));
        const localStats = calcStats(results.map(r => r.localTimeMs));
        const netStats = calcStats(results.map(r => r.networkTimeMs));
        const retryStats = calcStats(results.map(r => r.retryTimeMs));

        console.log('\n======================================================');
        console.log(`[QUEUE DRAIN BENCHMARK: 500 Operations]`);
        console.log(`Local Processing Time  -> Median: ${localStats.median.toFixed(2)} ms | Mean: ${localStats.mean.toFixed(2)} ms | p95: ${localStats.p95.toFixed(2)} ms | StdDev: ${localStats.stdDev.toFixed(2)} ms`);
        console.log(`Simulated Network Time -> Median: ${netStats.median.toFixed(2)} ms | Mean: ${netStats.mean.toFixed(2)} ms | p95: ${netStats.p95.toFixed(2)} ms | StdDev: ${netStats.stdDev.toFixed(2)} ms`);
        console.log(`Retry Latency (5% err) -> Median: ${retryStats.median.toFixed(2)} ms | Mean: ${retryStats.mean.toFixed(2)} ms | p95: ${retryStats.p95.toFixed(2)} ms | StdDev: ${retryStats.stdDev.toFixed(2)} ms`);
        console.log(`Total Drain Time       -> Median: ${totalStats.median.toFixed(2)} ms | Mean: ${totalStats.mean.toFixed(2)} ms | p95: ${totalStats.p95.toFixed(2)} ms | StdDev: ${totalStats.stdDev.toFixed(2)} ms`);
        console.log(`Effective Throughput   -> ${(500 / (totalStats.median / 1000)).toFixed(1)} ops/sec`);
        console.log('======================================================');

        expect(totalStats.median).toBeGreaterThan(0);
    });

    test('Synthetic Drain Benchmark: 1,000 Operations', async () => {
        const runs = 3;
        const results = [];
        for (let r = 0; r < runs; r++) {
            results.push(await simulateQueueDrain({ opCount: 1000, simulatedRttMs: 0.5, failureRate: 0.05 }));
        }

        const totalStats = calcStats(results.map(r => r.totalDurationMs));
        const localStats = calcStats(results.map(r => r.localTimeMs));
        const netStats = calcStats(results.map(r => r.networkTimeMs));
        const retryStats = calcStats(results.map(r => r.retryTimeMs));

        console.log('\n======================================================');
        console.log(`[QUEUE DRAIN BENCHMARK: 1,000 Operations]`);
        console.log(`Local Processing Time  -> Median: ${localStats.median.toFixed(2)} ms | Mean: ${localStats.mean.toFixed(2)} ms | p95: ${localStats.p95.toFixed(2)} ms | StdDev: ${localStats.stdDev.toFixed(2)} ms`);
        console.log(`Simulated Network Time -> Median: ${netStats.median.toFixed(2)} ms | Mean: ${netStats.mean.toFixed(2)} ms | p95: ${netStats.p95.toFixed(2)} ms | StdDev: ${netStats.stdDev.toFixed(2)} ms`);
        console.log(`Retry Latency (5% err) -> Median: ${retryStats.median.toFixed(2)} ms | Mean: ${retryStats.mean.toFixed(2)} ms | p95: ${retryStats.p95.toFixed(2)} ms | StdDev: ${retryStats.stdDev.toFixed(2)} ms`);
        console.log(`Total Drain Time       -> Median: ${totalStats.median.toFixed(2)} ms | Mean: ${totalStats.mean.toFixed(2)} ms | p95: ${totalStats.p95.toFixed(2)} ms | StdDev: ${totalStats.stdDev.toFixed(2)} ms`);
        console.log(`Effective Throughput   -> ${(1000 / (totalStats.median / 1000)).toFixed(1)} ops/sec`);
        console.log('======================================================\n');

        expect(totalStats.median).toBeGreaterThan(0);
    });
});
