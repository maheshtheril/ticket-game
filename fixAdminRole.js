
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables manually due to encoding issues
// Load environment variables
const fs = require('fs');
let envConfig = {};
try {
    const envFile = fs.readFileSync(path.resolve(__dirname, '.env'), 'utf16le');
    envFile.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim().replace(/\r/g, '');
            envConfig[key] = val;
        }
    });
} catch (e) {
    console.error("Failed to read .env:", e);
}

const supabaseUrl = envConfig.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = envConfig.EXPO_PUBLIC_SUPABASE_KEY || process.env.EXPO_PUBLIC_SUPABASE_KEY;

console.log("Starting Admin Check...");
if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdmin() {
    const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', 'admin');

    if (error) {
        console.error('Error fetching admin:', error);
        return;
    }

    if (!users || users.length === 0) {
        console.log("No user found with username 'admin'");
    } else {
        console.log("Admin user found:", users[0]);
        // Update Password to 'admin_123'
        if (users[0].password_hash !== 'admin_123') {
            console.log(`Updating password to 'admin_123'...`);
            const { error: passError } = await supabase.from('users').update({ password_hash: 'admin_123' }).eq('id', users[0].id);
            if (passError) console.error("Error updating password:", passError);
            else console.log("Password updated.");
        }

        if (users[0].role !== 'admin') {
            console.log(`User 'admin' has incorrect role: '${users[0].role}'. Updating to 'admin'...`);
            const { error: updateError } = await supabase
                .from('users')
                .update({ role: 'admin' })
                .eq('username', 'admin');

            if (updateError) console.error("Error updating role:", updateError);
            else console.log("Successfully updated 'admin' role to 'admin'.");
        } else {
            console.log("User 'admin' already has role 'admin'.");
        }
    }
}

checkAdmin();
