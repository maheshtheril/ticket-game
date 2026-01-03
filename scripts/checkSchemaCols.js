
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '../.env');
try {
    const envFile = fs.readFileSync(envPath, 'utf16le');
    const lines = envFile.split('\n');
    lines.forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim();
            if (key && val) process.env[key] = val;
        }
    });
} catch (e) { }

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_KEY);

async function checkSchema() {
    // Try to select the specific columns to see if they exist
    const { data, error } = await supabase.from('game_schedules').select('id, name, close_time, fill_time, deletion_time, open_time').limit(1);

    if (error) {
        console.log("Error checking columns:", error.message);
    } else {
        console.log("Columns match! Data sample:", data);
    }
}
checkSchema();
