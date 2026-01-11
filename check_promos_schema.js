const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.argv[2], process.argv[3]);

async function checkSchema() {
    console.log("--- Checking promotions table ---");
    const { data: promos, error: promoError } = await supabase.from("promotions").select("*").limit(1);
    if (promoError) console.error("Error with promotions table:", promoError.message);
    else console.log("Promotions table: EXISTS");

    console.log("\n--- Checking promotion_products table ---");
    const { data: links, error: linkError } = await supabase.from("promotion_products").select("*").limit(1);
    if (linkError) console.error("Error with promotion_products table:", linkError.message);
    else console.log("Promotion_products table: EXISTS");
}

checkSchema();
