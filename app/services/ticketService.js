
// Mock Ticket Service (No Supabase)
import { GAMES } from '../constants/theme';

export const ticketService = {
    // 1. Get Active Games (Mock)
    async getActiveGames() {
        console.log('Fetching games (MOCK)...');
        return { data: GAMES, error: null };
    },

    // 2. Buy Ticket (Mock)
    async buyTicket(tickets, userId) {
        console.log('Saving tickets (MOCK)...', tickets);
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        return { data: { success: true }, error: null };
    }
};
