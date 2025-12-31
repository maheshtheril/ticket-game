import { supabase } from '../lib/supabase';

export const ticketService = {
    // 0. Login
    async login(username, password) {
        try {
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .single();

            if (error || !user) {
                return { error: 'User not found' };
            }

            // Simple password check for simulation (In real app, use bcrypt on server)
            if (user.password_hash !== password) {
                return { error: 'Invalid password' };
            }

            if (!user.is_active) {
                return { error: 'User is inactive' };
            }

            return { data: user, error: null };
        } catch (err) {
            return { error: err.message };
        }
    },

    // 0.1 Create User (Recursive Hierarchy)
    async createUser(currentUser, newUsername, newPassword, initialBalance) {
        // hierarchy map
        const roleMap = {
            'admin': 'main_agent',
            'main_agent': 'sub_agent',
            'sub_agent': 'stockist',
            'stockist': 'user'
        };

        const newRole = roleMap[currentUser.role];
        if (!newRole) {
            return { error: `Role '${currentUser.role}' cannot create sub-users.` };
        }

        try {
            const { data, error } = await supabase
                .from('users')
                .insert([{
                    username: newUsername,
                    password_hash: newPassword,
                    role: newRole,
                    parent_id: currentUser.id,
                    balance: parseFloat(initialBalance) || 0,
                    is_active: true
                }])
                .select()
                .single();

            if (error) throw error;
            return { data, error: null };
        } catch (err) {
            return { error: err.message };
        }
    },

    // 1. Get Active Game Schedules
    async getActiveGames() {
        const { data: games, error } = await supabase
            .from('game_schedules')
            .select('*')
            .eq('is_active', true)
            .order('draw_time', { ascending: true });

        if (error) {
            console.error('Error fetching games:', error);
            return { data: [], error };
        }
        return { data: games, error: null };
    },

    // 2. Buy Tickets
    async buyTicket(tickets, gameId, userId) {
        if (!tickets || tickets.length === 0) return { error: { message: 'No tickets to save' } };

        try {
            // B. Get or Create Daily Draw
            // We need a draw for TODAY for this gameId
            const today = new Date().toISOString().split('T')[0];

            let { data: draw, error: drawError } = await supabase
                .from('daily_draws')
                .select('id')
                .eq('schedule_id', gameId)
                .eq('draw_date', today)
                .maybeSingle();

            if (drawError) throw drawError;

            // If no draw exists, create one (Auto-open the draw)
            if (!draw) {
                const { data: newDraw, error: createError } = await supabase
                    .from('daily_draws')
                    .insert([{ schedule_id: gameId, draw_date: today }])
                    .select('id')
                    .single();

                if (createError) throw createError;
                draw = newDraw;
            }

            // C. Prepare Ticket Data
            const dbTickets = tickets.map(t => ({
                draw_id: draw.id,
                user_id: userId,
                ticket_number: t.number,
                ticket_type: mapTypeToEnum(t.boxType),
                count: parseInt(t.count),
                cost_per_unit: 10.00, // Hardcoded or fetch from settings
                status: 'active'
            }));

            // D. Insert Tickets
            const { data: savedTickets, error: insertError } = await supabase
                .from('tickets')
                .insert(dbTickets)
                .select();

            if (insertError) throw insertError;

            return { data: savedTickets, error: null };

        } catch (err) {
            console.error('Buy Ticket Error:', err);
            return { data: null, error: err };
        }
    }
};

// Helper to map UI types to DB Enum
function mapTypeToEnum(uiType) {
    // UI: SUPER, BOX, etc.
    // DB: single, double, triple, quad
    // Default mapping for now:
    if (uiType === 'SUPER') return 'single';
    if (uiType === 'BOX') return 'double';
    return 'single'; // Fallback
}
