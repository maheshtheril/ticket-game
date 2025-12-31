import { supabase } from '../lib/supabase';

export const ticketService = {
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
    async buyTicket(tickets, gameId, agentUsername) {
        if (!tickets || tickets.length === 0) return { error: { message: 'No tickets to save' } };

        try {
            // A. Get User (Agent) ID
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('id, balance')
                .eq('username', agentUsername)
                .single();

            if (userError || !user) throw new Error('Agent not found. Please log in.');

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
            // Map App types "SUPER" (A) -> 'single', "BOX" (B) -> 'double' for schema compliance
            // Note: Adjust logic if schema types differ.
            const dbTickets = tickets.map(t => ({
                draw_id: draw.id,
                user_id: user.id,
                ticket_number: t.number,
                ticket_type: mapTypeToEnum(t.boxType), // You need to implement this
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
