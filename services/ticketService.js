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

            console.log("Login Attempt:", username, password);
            if (error) console.log("Login Error:", error);
            if (user) console.log("User Found:", user.username, user.password_hash);

            if (error || !user) {
                return { error: 'User not found' };
            }

            // Simple password check for simulation (In real app, use bcrypt on server)
            if (user.password_hash !== password) {
                console.log("Password Mismatch. Input:", password, "Stored:", user.password_hash);
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
        const roleMap = {
            'admin': 'main_agent',
            'main_agent': 'sub_agent',
            'sub_agent': 'stockist',
            'stockist': 'sub_stockist',
            'sub_stockist': 'user'
        };

        const newRole = roleMap[currentUser.role];
        if (!newRole) {
            return { error: `Role '${currentUser.role}' cannot create sub-users.` };
        }

        try {
            // 1. Create User
            const { data: newUser, error } = await supabase
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

            // 2. Inherit Limits (Copy from Parent)
            const { data: parentLimits } = await supabase
                .from('user_limits')
                .select('*')
                .eq('user_id', currentUser.id)
                .single();

            if (parentLimits) {
                await supabase.from('user_limits').insert([{
                    user_id: newUser.id,
                    daily_sales_limit: parentLimits.daily_sales_limit,
                    weekly_sales_limit: parentLimits.weekly_sales_limit,
                    max_single_number_count: parentLimits.max_single_number_count,
                    blocked_numbers: parentLimits.blocked_numbers,
                    special_number_limits: parentLimits.special_number_limits
                }]);
            }

            // 3. Inherit Rates (Copy from Parent Scheme)
            const { data: parentUser } = await supabase.from('users').select('scheme_id').eq('id', currentUser.id).single();

            if (parentUser && parentUser.scheme_id) {
                // 3.1 Create New Scheme for Child
                const { data: newScheme, error: schemeError } = await supabase
                    .from('schemes')
                    .insert([{ name: `Scheme for ${newUser.username}` }])
                    .select('id')
                    .single();

                if (!schemeError) {
                    // 3.2 Copy Rates
                    const { data: parentRates } = await supabase
                        .from('scheme_rates')
                        .select('ticket_type, buy_rate, sell_rate')
                        .eq('scheme_id', parentUser.scheme_id);

                    if (parentRates && parentRates.length > 0) {
                        const rateInserts = parentRates.map(r => ({
                            scheme_id: newScheme.id,
                            ticket_type: r.ticket_type,
                            buy_rate: r.buy_rate, // Inherit Rate
                            sell_rate: r.sell_rate
                        }));
                        await supabase.from('scheme_rates').insert(rateInserts);
                    }

                    // 3.3 Assign Scheme to Child
                    await supabase.from('users').update({ scheme_id: newScheme.id }).eq('id', newUser.id);
                }
            }

            return { data: newUser, error: null };
        } catch (err) {
            return { error: err.message };
        }
    },

    // 0.2 Get Sub-Users (Direct Children)
    async getSubUsers(parentId) {
        const { data: users, error } = await supabase
            .from('users')
            .select('id, username, role, balance')
            .eq('parent_id', parentId)
            .eq('is_active', true);

        if (error) {
            console.error('Error fetching sub-users:', error);
            return { data: [], error };
        }
        return { data: users, error: null };
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

    async getGameById(id) {
        const { data, error } = await supabase
            .from('game_schedules')
            .select('*')
            .eq('id', id)
            .single();
        return { data, error };
    },

    async toggleGameStatus(gameId, isActive) {
        const { error } = await supabase
            .from('game_schedules')
            .update({ is_active: isActive })
            .eq('id', gameId);
        return { error };
    },

    async updateGameSettings(gameId, settings) {
        const { error } = await supabase
            .from('game_schedules')
            .update(settings)
            .eq('id', gameId);
        return { error };
    },

    // 3. Helper: Get User Scheme Rates
    async getUserRates(userId) {
        // Get user's scheme_id
        const { data: user } = await supabase.from('users').select('scheme_id').eq('id', userId).single();
        if (!user || !user.scheme_id) return {}; // Fallback

        const { data: rates } = await supabase
            .from('scheme_rates')
            .select('ticket_type, buy_rate, commission, payout')
            .eq('scheme_id', user.scheme_id);

        // Convert to map: { 'single': 10.0, 'double': 11.0 }
        const rateMap = {};
        if (rates) rates.forEach(r => {
            // If caller expects just number (legacy), we might break it. 
            // But we updated App.js to handle object or number logic?
            // Let's return object, but we need to check usage sites.
            // Looking at App.js: const myRate = rates[item.key] || 0; 
            // If we change this to object, App.js 796 will fail (rate becomes object).
            // However, I updated App.js to handle this in Step 1840? No, I used parseFloat(rates[item.key]).
            // So I MUST attach properties to the object.
            // JS allows Number object with properties? No, primitives.
            // I should store full object and .buy_rate in App.js.
            rateMap[r.ticket_type] = {
                buy_rate: r.buy_rate,
                commission: r.commission,
                payout: r.payout,
                // Backward compat
                toString: () => r.buy_rate.toString()
            };
        });
        return rateMap;
    },

    // 3.1 Update User Rates
    async updateUserRates(targetUserId, ratesMap) {
        // 1. Get Target User & Parent
        const { data: user } = await supabase.from('users').select('scheme_id, username, parent_id').eq('id', targetUserId).single();
        if (!user) return { error: 'User not found' };

        // **Validation: Check against Parent Rates**
        if (user.parent_id) {
            const parentRates = await this.getUserRates(user.parent_id);
            for (const type of Object.keys(ratesMap)) {
                const newRate = parseFloat(ratesMap[type]);
                const parentRate = parseFloat(parentRates[type]);

                // If parent has no rate for this type, can child have it? Assuming 0.
                // "Child rate <= Parent rate"
                if (!isNaN(parentRate) && newRate > parentRate) {
                    return { error: `Rate for ${type} (${newRate}) cannot exceed Reference/Parent Rate (${parentRate})` };
                }
            }
        }

        let schemeId = user.scheme_id;

        // 2. If no scheme, create one
        if (!schemeId) {
            const { data: newScheme, error: schemeError } = await supabase
                .from('schemes')
                .insert([{ name: `Scheme for ${user.username}` }])
                .select('id')
                .single();

            if (schemeError) {
                console.error('Scheme creation failed', schemeError);
                return { error: 'Failed to create scheme. Contact Admin.' };
            }
            schemeId = newScheme.id;

            // Link to user
            await supabase.from('users').update({ scheme_id: schemeId }).eq('id', targetUserId);
        }

        // 3. Upsert Rates
        const updates = Object.keys(ratesMap).map(type => ({
            scheme_id: schemeId,
            ticket_type: type,
            buy_rate: parseFloat(ratesMap[type])
        }));

        const { error: rateError } = await supabase.from('scheme_rates').upsert(updates, { onConflict: 'scheme_id, ticket_type' });

        if (rateError) return { error: rateError.message };
        return { data: true, error: null };
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
        return { allowed: true };
    },

    async getUserLimits(userId) {
        return await supabase.from('user_limits').select('*').eq('user_id', userId).single();
    },

    // 4.1 Update User Limits
    async updateUserLimits(userId, limits) {
        // Validation: Check Parent
        const { data: user } = await supabase.from('users').select('parent_id').eq('id', userId).single();
        if (user && user.parent_id) {
            const { data: parentLimits } = await supabase.from('user_limits').select('*').eq('user_id', user.parent_id).single();
            if (parentLimits) {
                if (limits.daily_sales_limit && parseFloat(limits.daily_sales_limit) > parseFloat(parentLimits.daily_sales_limit)) {
                    return { error: `Daily Limit cannot exceed Parent's Limit (${parentLimits.daily_sales_limit})` };
                }
                if (limits.weekly_sales_limit && parseFloat(limits.weekly_sales_limit) > parseFloat(parentLimits.weekly_sales_limit)) {
                    return { error: `Weekly Limit cannot exceed Parent's Limit (${parentLimits.weekly_sales_limit})` };
                }
                if (limits.max_single_number_count && parseInt(limits.max_single_number_count) > parseInt(parentLimits.max_single_number_count)) {
                    return { error: `Max Count cannot exceed Parent's Limit (${parentLimits.max_single_number_count})` };
                }
            }
        }

        // limits: { daily_sales_limit: 1000, max_single_number_count: 50, ... }
        const { error } = await supabase
            .from('user_limits')
            .upsert({ user_id: userId, ...limits }, { onConflict: 'user_id' });

        if (error) return { error: error.message };
        return { data: true, error: null };
    },

    // 4.2 Toggle User Status (Block)
    async toggleUserStatus(userId, isActive) {
        const { error } = await supabase
            .from('users')
            .update({ is_active: isActive })
            .eq('id', userId);

        if (error) return { error: error.message };
        return { data: true, error: null };
    },

    // 2. Buy Tickets (ULTRA FAST v2.0)
    async buyTicket(tickets, gameId, userId) {
        if (!tickets || tickets.length === 0) return { error: { message: 'No tickets in cart' } };

        try {
            const start = Date.now();
            console.log("⚡ Starting Ultra-Fast Save...");

            // 1. Prepare data for RPC
            const ratesMap = await this.getUserRates(userId);
            let totalCost = 0;
            const payload = tickets.map(t => {
                const enumType = this.mapTypeToEnum(t.boxType);
                const rate = ratesMap[enumType]?.buy_rate || 10.0;
                totalCost += (parseInt(t.count) * rate);
                return {
                    number: t.number,
                    type: enumType,
                    count: parseInt(t.count)
                };
            });

            // ⚡ TRY THE DATA ENGINE (RPC) FIRST - This is the "World's Fastest" way
            // One network trip vs many.
            const { data: rpcData, error: rpcError } = await supabase.rpc('buy_tickets_bulk', {
                p_user_id: userId,
                p_game_id: gameId,
                p_tickets: payload,
                p_cost: totalCost
            });

            if (!rpcError && rpcData) {
                if (rpcData.error) return { error: { message: rpcData.error } };
                console.log(`✅ RPC Save Complete in ${Date.now() - start}ms`);
                return {
                    data: [{ id: 'batch', bill_number: rpcData.bill_number }],
                    error: null
                };
            }

            console.log("⚠️ RPC missing or failed, falling back to Optimized JS...");

            // --- OPTIMIZED JS FALLBACK (Parallel Fetching) ---
            const [
                { data: userBal },
                { data: adminUser },
                { data: userLimits },
                { data: existingDraw }
            ] = await Promise.all([
                supabase.from('users').select('balance, role').eq('id', userId).single(),
                supabase.from('users').select('id').eq('role', 'admin').maybeSingle(),
                supabase.from('user_limits').select('*').eq('user_id', userId).maybeSingle(),
                supabase.from('daily_draws').select('id').eq('schedule_id', gameId).eq('draw_date', new Date().toISOString().split('T')[0]).maybeSingle()
            ]);

            const userRole = userBal?.role;
            if (userRole !== 'admin' && userBal.balance < totalCost) return { error: { message: 'Insufficient Balance' } };

            let drawId = existingDraw?.id;
            if (!drawId) {
                const { data: newDraw } = await supabase.from('daily_draws').insert([{ schedule_id: gameId, draw_date: new Date().toISOString().split('T')[0] }]).select('id').single();
                drawId = newDraw.id;
            }

            // Fetch Admin Limits
            let gLimits = {};
            if (adminUser) {
                const { data: lim } = await supabase.from('user_limits').select('*').eq('user_id', adminUser.id).maybeSingle();
                gLimits = lim || {};
            }

            // Batch fetch sold totals
            const uniqueNumbers = [...new Set(tickets.map(t => t.number))];
            const { data: soldData } = await supabase.from('tickets').select('ticket_number, ticket_type, count').eq('draw_id', drawId).eq('status', 'active').in('ticket_number', uniqueNumbers);
            const soldTotals = {};
            soldData?.forEach(s => { soldTotals[`${s.ticket_number}_${s.ticket_type}`] = (soldTotals[`${s.ticket_number}_${s.ticket_type}`] || 0) + s.count; });

            // Local Validation
            const isAdmin = userId === adminUser?.id;
            const dbTickets = [];
            const billNo = Date.now();

            for (const t of tickets) {
                const type = this.mapTypeToEnum(t.boxType);
                const key = `${t.number}_${type}`;
                let limit = 9999;

                // Admin Global Limit
                if (type.includes('single')) limit = gLimits.max_single_number_count || 1000;
                else if (type.includes('double')) limit = gLimits.max_double_number_count || 500;
                else limit = (type === 'triple_straight' ? gLimits.max_triple_straight_count : gLimits.max_triple_box_count) || 50;

                // Global Hold
                if (!isAdmin) {
                    let hold = 0;
                    if (type.includes('single')) hold = gLimits.hold_single_number_count || 0;
                    else if (type.includes('double')) hold = gLimits.hold_double_number_count || 0;
                    else hold = (type === 'triple_straight' ? gLimits.hold_triple_straight_count : gLimits.hold_triple_box_count) || 0;
                    limit = Math.max(0, limit - hold);
                }

                if ((soldTotals[key] || 0) + parseInt(t.count) > limit) return { error: { message: `Limit reached for ${t.number}.` } };

                dbTickets.push({
                    draw_id: drawId, user_id: userId, ticket_number: t.number, ticket_type: type,
                    count: parseInt(t.count), cost_per_unit: ratesMap[type]?.buy_rate || 10, bill_number: billNo
                });
            }

            // Final Save
            const { data: finalData, error: finalErr } = await supabase.from('tickets').insert(dbTickets).select('id, bill_number');
            if (finalErr) throw finalErr;

            if (userRole !== 'admin') {
                await supabase.from('users').update({ balance: userBal.balance - totalCost }).eq('id', userId);
            }

            console.log(`✅ JS Save Complete in ${Date.now() - start}ms`);
            return { data: finalData, error: null };

        } catch (error) {
            console.error("Critical Save Error:", error);
            return { error: { message: error.message } };
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
    },

    // Helper to map UI types to DB Enum
    mapTypeToEnum(uiType) {
        // v1.9 Logging
        console.log("INTERNAL MAPPING V1.9:", uiType);

        if (!uiType) return 'triple_straight';
        const upper = uiType.toUpperCase();

        // 3-Digit
        if (upper === 'SUPER' || upper === 'TRIPLE_STRAIGHT') return 'triple_straight';
        if (upper === 'BOX' || upper === 'TRIPLE_BOX') return 'triple_box';

        // 2-Digit
        if (upper === 'AB') return 'double_ab';
        if (upper === 'AC') return 'double_ac';
        if (upper === 'BC') return 'double_bc';

        // 1-Digit
        if (upper === 'A') return 'single_a';
        if (upper === 'B') return 'single_b';
        if (upper === 'C') return 'single_c';

        // Passthrough
        if (uiType.includes('_')) return uiType;

        return 'triple_straight';
    }
};

// Helper to map UI types to DB Enum
// SCHEMA CONFIRMED: User is running database_schema_v2.sql clearly.
// Line 4: CREATE TYPE ticket_type AS ENUM ('single', 'double', 'triple', 'quad');
// It DOES NOT have 'triple_straight', 'triple_box', 'single_a' etc.
// We MUST map to 'triple' for all 3-digit plays.

// NOTE: This means 'Straight' and 'Box' are stored as the same 'triple' type in DB for now.
// We differentiate them by the ticket content (e.g. if we store "123 Box" in name? No, type is key).
// This is a current limitation of v2 schema.


// Helper: Check Permutation (ABC == CBA)
function checkPermutation(str1, str2) {
    if (str1.length !== str2.length) return false;
    return str1.split('').sort().join('') === str2.split('').sort().join('');
}
