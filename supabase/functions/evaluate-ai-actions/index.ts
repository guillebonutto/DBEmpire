import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ──────────────────────────────────────────────────────────────────
// EMPIRE AI — Evaluación Automática de Acciones (Edge Function)
// ──────────────────────────────────────────────────────────────────

export const config = {
  verify_jwt: false
};

const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Helper: get financial snapshot (Global or Product-specific)
async function getMetrics(targetProductName?: string): Promise<{
    monthlyRevenue: number;
    monthlyProfit: number;
}> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 1. Fetch completed sales only
    let query = supabase
        .from("sales")
        .select("id, total_amount, profit_generated, created_at")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .in("status", ["completed", "exitosa", ""]);

    const { data: recentSales } = await query;
    const saleIds = (recentSales || []).map(s => s.id);

    if (targetProductName && saleIds.length > 0) {
        // 2. Attribution: Only count profit from the specific product
        const { data: filteredItems } = await supabase
            .from("sale_items")
            .select("sale_id, quantity, unit_price_at_sale, products(name, cost_price)")
            .in("sale_id", saleIds);

        if (filteredItems && filteredItems.length > 0) {
            let pRevenue = 0;
            let pProfit = 0;
            filteredItems.forEach((item: any) => {
                const prodName = item.products?.name || '';
                if (prodName.toLowerCase().includes(targetProductName.toLowerCase())) {
                    const price = parseFloat(item.unit_price_at_sale) || 0;
                    const cost = parseFloat(item.products?.cost_price) || 0;
                    const qty = item.quantity || 1;
                    
                    pRevenue += price * qty;
                    pProfit += (price - cost) * qty;
                }
            });
            
            // If we found the product, return its specific metrics
            if (pRevenue > 0) return { monthlyRevenue: pRevenue, monthlyProfit: pProfit };
        }
    }

    // 3. Global fallback
    const monthlyRevenue = (recentSales || []).reduce(
        (sum: number, s: any) => sum + (parseFloat(s.total_amount) || 0), 0
    );
    const monthlyProfit = (recentSales || []).reduce(
        (sum: number, s: any) => sum + (parseFloat(s.profit_generated) || 0), 0
    );

    return { monthlyRevenue, monthlyProfit };
}

// Helper: Update confidence_score based on result
function computeNewConfidence(currentScore: number, profitDelta: number): number {
    const adj = profitDelta > 0 ? 0.5 : -0.5;
    return Math.min(10, Math.max(1, (currentScore || 1) + adj));
}

Deno.serve(async (req: Request) => {
    try {
        const authHeader = req.headers.get('authorization') || '';
        const cronKey = Deno.env.get('EXPECTED_CRON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';
        
        if (!authHeader.includes(cronKey)) {
            return new Response(JSON.stringify({ error: 'Unauthorized payload source' }), { status: 401 });
        }

        const now = new Date();
        const { data: pendingActions, error: fetchError } = await supabase
            .from("ai_action_logs")
            .select("*")
            .eq("executed", true)
            .is("profit_delta", null)
            .neq("evaluation_status", "skipped")
            .gte("executed_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
            .limit(50);

        if (fetchError) throw new Error(`Fetch error: ${fetchError.message}`);
        
        let evaluatedCount = 0;
        let skippedCount = 0;

        for (const action of (pendingActions || [])) {
            if (!action.executed_at) {
                await supabase.from("ai_action_logs").update({ evaluation_status: "skipped" }).eq("id", action.id);
                skippedCount++;
                continue;
            }

            const executedAt = new Date(action.executed_at);
            const diffHours = (now.getTime() - executedAt.getTime()) / (1000 * 60 * 60);

            if (diffHours < (action.evaluation_window_hours || 48)) {
                skippedCount++;
                continue;
            }

            // Target extraction for attribution
            const target = (action.action_type === 'restock' || action.action_type === 'marketing') 
                ? action.title.split(':').pop()?.trim() 
                : undefined;
            
            const currentMetrics = await getMetrics(target);
            const prevSnapshot = action.context_snapshot || {};
            const profit_delta = currentMetrics.monthlyProfit - (prevSnapshot.monthlyProfit || 0);
            const revenue_delta = currentMetrics.monthlyRevenue - (prevSnapshot.monthlyRevenue || 0);
            const new_confidence = computeNewConfidence(action.confidence_score || 1, profit_delta);

            await supabase.from("ai_action_logs").update({
                profit_delta,
                revenue_delta,
                result_snapshot: currentMetrics,
                evaluation_status: "evaluated",
                confidence_score: new_confidence
            }).eq("id", action.id);

            evaluatedCount++;
        }

        return new Response(JSON.stringify({ status: "ok", evaluated: evaluatedCount, skipped: skippedCount, timestamp: now.toISOString() }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ status: "error", message: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
});
