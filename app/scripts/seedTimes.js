
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

async function seedTimes() {
    console.log("Seeding default times...");
    const { data: games } = await supabase.from('game_schedules').select('*');

    for (const g of games) {
        let updates = {};
        const name = g.name.toUpperCase();

        if (name.includes('1 PM') || name.includes('1:00')) {
            updates = { close_time: '12:55:00', fill_time: '13:05:00', deletion_time: '12:58:00', open_time: '14:00:00' };
        } else if (name.includes('3.00') || name.includes('3:00')) {
            updates = { close_time: '14:55:00', fill_time: '15:05:00', deletion_time: '14:58:00', open_time: '16:00:00' };
        } else if (name.includes('6PM') || name.includes('6:00') || name.includes('06:00')) {
            updates = { close_time: '17:55:00', fill_time: '18:05:00', deletion_time: '17:58:00', open_time: '19:00:00' };
        } else if (name.includes('8PM') || name.includes('8:00') || name.includes('08:00')) {
            updates = { close_time: '19:55:00', fill_time: '20:05:00', deletion_time: '19:58:00', open_time: '21:00:00' };
        }

        if (Object.keys(updates).length > 0) {
            console.log(`Updating ${g.name}...`, updates);
            const { error } = await supabase.from('game_schedules').update(updates).eq('id', g.id);
            if (error) console.error("Error:", error);
        }
    }
    console.log("Done.");
}

seedTimes();
