
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
            const val = parts.slice(1).join('=').trim().replace(/\r/g, '');
            if (key && val) process.env[key] = val;
        }
    });
} catch (e) {
    console.error("Error reading .env", e);
}

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_KEY);

const games = [
    { name: 'D-1:00 PM', draw_time: '2000-01-01T13:00:00', is_active: true },
    { name: 'K-3:00 PM', draw_time: '2000-01-01T15:00:00', is_active: true },
    { name: 'D-6:00 PM', draw_time: '2000-01-01T18:00:00', is_active: true },
    { name: 'D-8:00 PM', draw_time: '2000-01-01T20:00:00', is_active: true }
];

async function run() {
    console.log("Checking existing games...");
    const { data: existing } = await supabase.from('game_schedules').select('*');
    if (existing && existing.length > 0) {
        console.log("Games already exist:", existing.length);
        existing.forEach(g => {
            console.log(`- ${g.name} (Active: ${g.is_active}) | Draw: ${g.draw_time} | Open: ${g.open_time} | Close: ${g.close_time}`);
        });
        return;
    }

    console.log("Creating games...");
    const { data, error } = await supabase.from('game_schedules').insert(games).select();
    if (error) {
        console.error("Error creating games:", error);
    } else {
        console.log("Games created:", data);
    }
}

run();
