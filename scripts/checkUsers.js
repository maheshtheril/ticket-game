
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
    const { data: user } = await supabase.from('users').select('username, role, password_hash').eq('username', 'admin').single();
    if (user) {
        console.log(`U:${user.username}|R:${user.role}|PWD:${user.password_hash}|`);
    } else {
        console.log("NOT FOUND");
    }
}
check();
