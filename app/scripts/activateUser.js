const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

async function activateAdmin() {
    const envPath = path.resolve(__dirname, '../.env');
    let envContent;
    try {
        envContent = fs.readFileSync(envPath, 'utf16le'); // Try UTF-16 LE first
        if (!envContent.includes('SUPABASE')) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }
    } catch (e) {
        console.error('Could not read .env at', envPath);
        process.exit(1);
    }

    const env = {};
    envContent.split('\n').forEach(line => {
        const [key, val] = line.split('=');
        if (key && val) env[key.trim()] = val.trim();
    });

    const url = env.EXPO_PUBLIC_SUPABASE_URL;
    const key = env.EXPO_PUBLIC_SUPABASE_KEY;
    console.log('Connecting to Supabase...');
    const supabase = createClient(url, key);

    console.log('Activating admin user...');

    // First, check current status
    const { data: current, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('username', 'admin')
        .single();

    if (current) {
        console.log('Current Admin Status:', current);
    }

    // Update
    const { data, error } = await supabase
        .from('users')
        .update({ is_active: true })
        .eq('username', 'admin')
        .select();

    if (error) {
        console.error('Error activating user:', JSON.stringify(error, null, 2));
    } else {
        console.log('Success! Admin activated:', data);
    }
}

activateAdmin();
