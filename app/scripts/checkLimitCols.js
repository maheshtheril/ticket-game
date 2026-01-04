const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
console.log("URL:", process.env.EXPO_PUBLIC_SUPABASE_URL ? "Found" : "Missing");
console.log("KEY:", process.env.EXPO_PUBLIC_SUPABASE_KEY ? "Found" : "Missing");

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_KEY);

async function updateLimitsTable() {
    console.log("Updating user_limits table...");

    // We cannot easily run ALTER TABLE via client unless we have an RPC or raw SQL access.
    // Assuming we do NOT have raw SQL execution RPC set up by default.
    // But we can check columns and 'mock' the migration locally if we had direct access.
    // Since we rely on Supabase client, the user usually needs to run SQL in Dashboard.
    // However, I will TRY to use a dedicated RPC if it exists, or just log instructions.

    // Attempting standard columns check
    const { data, error } = await supabase.from('user_limits').select('*').limit(1);

    if (error) {
        console.error("Error accessing user_limits:", error.message);
        return;
    }

    const keys = data && data.length > 0 ? Object.keys(data[0]) : [];
    console.log("Current Columns:", keys);

    const needed = [
        'max_triple_straight_count',
        'max_triple_box_count',
        'hold_single_number_count',
        'hold_double_number_count',
        'hold_triple_straight_count',
        'hold_triple_box_count',
        'number_limit_overrides'
    ];

    const missing = needed.filter(k => !keys.includes(k));

    if (missing.length > 0) {
        console.log("MISSING COLUMNS:", missing);
        console.log("\n*** ACTION REQUIRED ***");
        console.log("Please run the following SQL in your Supabase Dashboard SQL Editor:");
        missing.forEach(col => {
            let type = col.includes('overrides') ? 'JSONB DEFAULT \'{}\'::jsonb' : 'INT DEFAULT 50';
            if (col.includes('hold')) type = 'INT DEFAULT 25';
            console.log(`ALTER TABLE user_limits ADD COLUMN IF NOT EXISTS ${col} ${type};`);
        });
    } else {
        console.log("All columns present.");
    }
}

updateLimitsTable();
