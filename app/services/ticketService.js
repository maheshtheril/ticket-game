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

            // Check is_active only if it exists (defaults to true)
            // If column is missing in older schema, user.is_active will be undefined
            if (user.is_active === false) {
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
            //.eq('is_active', true) // User requested ALL games
            .order('draw_time', { ascending: true });

        if (error) {
            console.error('Error fetching games:', error);
            return { data: [], error };
        }
        return { data: games, error: null };
    },

    // 3. Helper: Get User Scheme Rates
    async getUserRates(userId) {
        // Get user's scheme_id
        const { data: user } = await supabase.from('users').select('scheme_id').eq('id', userId).single();
        if (!user || !user.scheme_id) return {}; // Fallback

        const { data: rates } = await supabase
            .from('scheme_rates')
            .select('ticket_type, buy_rate')
            .eq('scheme_id', user.scheme_id);

        // Convert to map: { 'single': 10.0, 'double': 11.0 }
        const rateMap = {};
        if (rates) rates.forEach(r => rateMap[r.ticket_type] = r.buy_rate);
        return rateMap;
    },

    // 4. Helper: Check Limits
    async checkLimits(userId, newTickets, totalCost) {
        // A. Check Daily Sales Limit
        const today = new Date().toISOString().split('T')[0];

        // Get Limit
        const { data: limits } = await supabase.from('user_limits').select('*').eq('user_id', userId).single();

        // If no limits defined, allow (or default to some hard limit)
        if (!limits) return { allowed: true };

        // Get Current Sales Today (Sum tickets.total_cost)
        // Note: Real app should use a more efficient query or materialized view
        const { data: salesData } = await supabase
            .from('tickets')
            .select('total_cost')
            .eq('user_id', userId)
            .gte('created_at', today + 'T00:00:00');

        const currentTotal = salesData ? salesData.reduce((sum, t) => sum + (t.total_cost || 0), 0) : 0;

        if (limits.daily_sales_limit && (currentTotal + totalCost > limits.daily_sales_limit)) {
            return { allowed: false, reason: `Daily Limit Exceeded. Limit: ${limits.daily_sales_limit}, Used: ${currentTotal}` };
        }

        // B. Check Number Limits (Max Count per Number)
        // Group new tickets by number
        const numberCounts = {};
        newTickets.forEach(t => {
            if (!numberCounts[t.number]) numberCounts[t.number] = 0;
            numberCounts[t.number] += parseInt(t.count);
        });

        // For each number, check DB count
        // Optimally: Batch check. Here: Loop (prototype)
        for (const num of Object.keys(numberCounts)) {
            const newCount = numberCounts[num];

            // Decide which limit applies based on length
            let limit = 1000;
            if (num.length === 1) limit = limits.max_single_number_count || 1000;
            if (num.length === 2) limit = limits.max_double_number_count || 1000;
            if (num.length === 3) limit = limits.max_triple_number_count || 1000;

            // Fetch current count for this number today
            // This is expensive in loop - optimizing for V1
            const { count: currentCount } = await supabase
                .from('tickets')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId) // Risk usually check Global or User? Requirement says "Each user has limits".
                .eq('ticket_number', num)
                .gte('created_at', today + 'T00:00:00'); // Assuming daily limit per number

            if ((currentCount || 0) + newCount > limit) {
                return { allowed: false, reason: `Limit validation failed for Number ${num}. Max: ${limit}` };
            }
        }

        return { allowed: true };
    },

    // 2. Buy Tickets (UPDATED)
    async buyTicket(tickets, gameId, userId) {
        if (!tickets || tickets.length === 0) return { error: { message: 'No tickets to save' } };

        try {
            // A. Get Rates
            const rates = await this.getUserRates(userId);

            // B. Calculate Cost & Prepare objects
            const dbTickets = [];
            let totalBatchCost = 0;

            // Pre-process to create DB friendly array
            // We need draw_id first.

            // Get Draw (Same as before)
            const today = new Date().toISOString().split('T')[0];
            let { data: draw, error: drawError } = await supabase
                .from('daily_draws').select('id').eq('schedule_id', gameId).eq('draw_date', today).maybeSingle();
            if (drawError) throw drawError;
            if (!draw) {
                const { data: newDraw, error: createError } = await supabase
                    .from('daily_draws').insert([{ schedule_id: gameId, draw_date: today }]).select('id').single();
                if (createError) throw createError;
                draw = newDraw;
            }

            tickets.forEach(t => {
                const enumType = mapTypeToEnum(t.boxType);
                const rate = rates[enumType] || 10.00; // Default if no scheme
                const count = parseInt(t.count);
                const total = count * rate;

                totalBatchCost += total;

                dbTickets.push({
                    draw_id: draw.id,
                    user_id: userId,
                    ticket_number: t.number,
                    ticket_type: enumType,
                    count: count,
                    cost_per_unit: rate,
                    status: 'active'
                });
            });

            // C. Validate Limits
            const limitCheck = await this.checkLimits(userId, tickets, totalBatchCost);
            if (!limitCheck.allowed) {
                return { error: { message: limitCheck.reason } };
            }

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
    },
    // 5. Declare Result (Admin)
    async declareResult(gameId, resultNumber) {
        const today = new Date().toISOString().split('T')[0];
        try {
            // Update Daily Draw
            const { data: draw, error } = await supabase
                .from('daily_draws')
                .update({
                    result_number: resultNumber,
                    is_declared: true,
                    declared_at: new Date()
                })
                .eq('schedule_id', gameId)
                .eq('draw_date', today)
                .select()
                .single();

            if (error) throw error;
            if (!draw) return { error: 'No draw found for today to declare.' };

            // Trigger Calculation
            await this.calculateWinnings(draw.id, resultNumber);

            return { data: draw, error: null };
        } catch (err) {
            return { error: err.message };
        }
    },

    // 6. Calculate Winnings (Batch Job Logic)
    async calculateWinnings(drawId, resultNumber) {
        // Fetch All Active Tickets for Draw
        const { data: tickets } = await supabase
            .from('tickets')
            .select('*')
            .eq('draw_id', drawId)
            .eq('status', 'active');

        if (!tickets || tickets.length === 0) return;

        const updates = [];

        // Define Winnings Table (Simplified for MVP, ideally fetched from DB)
        // 1st Prize (Straight) = 5000
        // 1st Prize (Box) = 3000

        for (const t of tickets) {
            let isWinner = false;
            let winAmount = 0;
            let commission = 0;

            if (t.ticket_type === 'triple_straight') {
                if (t.ticket_number === resultNumber) {
                    isWinner = true;
                    winAmount = 5000 * t.count;
                    commission = 400 * t.count;
                }
            } else if (t.ticket_type === 'triple_box') {
                // Check Permutation
                if (checkPermutation(t.ticket_number, resultNumber)) {
                    isWinner = true;
                    winAmount = 3000 * t.count;
                    commission = 200 * t.count;
                }
            }
            // Add other rules (Single/Double/2nd Prize etc later)

            if (isWinner) {
                updates.push({
                    id: t.id,
                    status: 'won',
                    winning_amount: winAmount,
                    winning_tax_commission: commission
                });
            } else {
                updates.push({
                    id: t.id,
                    status: 'lost'
                });
            }
        }

        // Batch Update (Supabase doesn't support bulk update easily via client, so loop or RPC)
        // For MVP/Demo: Loop update (Not performant for 10k tickets, but ok for demo)
        for (const update of updates) {
            await supabase.from('tickets').update(update).eq('id', update.id);
        }
    }
};

// Helper to map UI types to DB Enum
function mapTypeToEnum(uiType) {
    if (uiType === 'SUPER') return 'triple_straight';
    if (uiType === 'BOX') return 'triple_box';
    if (uiType === 'AB' || uiType === 'AC' || uiType === 'BC') return 'double';
    if (uiType === 'A' || uiType === 'B' || uiType === 'C') return 'single';
    return 'single';
}

// Helper: Check Permutation (ABC == CBA)
function checkPermutation(str1, str2) {
    if (str1.length !== str2.length) return false;
    return str1.split('').sort().join('') === str2.split('').sort().join('');
}
