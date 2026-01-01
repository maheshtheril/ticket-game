
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

async function check() {
    const { data: games } = await supabase.from('game_schedules').select('*');
    if (games && games.length > 0) {
        console.log(`Games found: ${games.length}`);
        games.forEach(g => console.log(`- ${g.name} (${g.draw_time}) Active:${g.is_active}`));
    } else {
        console.log("NO GAMES FOUND");
    }
}
check();
