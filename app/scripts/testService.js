
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Mocking ticketService behavior
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

async function testGetGame() {
    console.log("Testing getGameById...");

    // Simulate what ticketService.getGameById does
    const id = 1; // Assuming ID 1 exists
    const { data, error } = await supabase
        .from('game_schedules')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Success:", data);
    }
}

testGetGame();
