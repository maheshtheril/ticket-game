import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import { ticketService } from '../services/ticketService';
import { Ionicons } from '@expo/vector-icons';

export default function ReportsView({ agent, onBack }) {
    const [activeTickets, setActiveTickets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedGameId, setSelectedGameId] = useState(null);
    const [games, setGames] = useState([]);

    useEffect(() => {
        loadGames();
    }, []);

    useEffect(() => {
        if (selectedGameId) {
            loadTickets();
        }
    }, [selectedGameId]);

    const loadGames = async () => {
        const { data } = await ticketService.getActiveGames();
        if (data) {
            setGames(data);
            // Auto-select first game
            if (data.length > 0) setSelectedGameId(data[0].id);
        }
    };

    const loadTickets = async () => {
        if (!agent || !selectedGameId) return;
        setLoading(true);
        // Helper to get today's draw
        const today = new Date().toISOString().split('T')[0];

        // Find draw id first
        const { data: draw } = await ticketService.supabase
            .from('daily_draws').select('id').eq('schedule_id', selectedGameId).eq('draw_date', today).maybeSingle();

        if (draw) {
            // Fetch tickets for this user & draw
            // We want LATEST first
            const { data } = await ticketService.supabase
                .from('tickets')
                .select('*')
                .eq('draw_id', draw.id)
                .eq('user_id', agent.id)
                .order('created_at', { ascending: false });

            if (data) setActiveTickets(data);
            else setActiveTickets([]);
        } else {
            setActiveTickets([]);
        }
        setLoading(false);
    };

    // Grouping Logic: Tickets bought within same second (batch)
    const groupedTickets = () => {
        const groups = {};
        activeTickets.forEach(t => {
            // Group by exact timestamp (ISO string ensures uniqueness per batch usually)
            const key = t.created_at;
            if (!groups[key]) groups[key] = [];
            groups[key].push(t);
        });

        // Convert to array and sort by time (Latest first)
        const batchKeys = Object.keys(groups).sort((a, b) => new Date(b) - new Date(a));
        const totalBatches = batchKeys.length;

        return batchKeys.map((key, index) => {
            const batchTickets = groups[key];
            // Assign Bill Number: Earliest is #1, Latest is #Total
            const billNumber = totalBatches - index;
            const displayTime = new Date(key).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            return {
                key: key,
                billNumber: billNumber,
                time: displayTime,
                tickets: batchTickets
            };
        });
    };

    const renderBatch = ({ item }) => {
        const { billNumber, time, tickets } = item;
        const totalAmount = tickets.reduce((sum, t) => sum + (t.count * t.cost_per_unit), 0);

        return (
            <View style={styles.batchCard}>
                <View style={styles.batchHeader}>
                    <Text style={{ fontWeight: 'bold', fontSize: 16 }}>Bill #{billNumber}</Text>
                    <Text style={{ fontSize: 12, color: '#666' }}>{time}</Text>
                </View>
                <View style={{ marginBottom: 5 }}>
                    <Text style={{ fontWeight: 'bold', color: COLORS.primary, textAlign: 'right' }}>Total: ₹{totalAmount}</Text>
                </View>
                {tickets.map(t => (
                    <View key={t.id} style={styles.ticketRow}>
                        <Text style={{ flex: 2 }}>{t.ticket_number} ({t.ticket_type})</Text>
                        <Text style={{ flex: 1, textAlign: 'center' }}>x{t.count}</Text>
                        <Text style={{ flex: 1, textAlign: 'right' }}>{(t.count * t.cost_per_unit).toFixed(2)}</Text>
                    </View>
                ))}
            </View>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
            <View style={{ padding: 15, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', elevation: 2 }}>
                <TouchableOpacity onPress={onBack}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={{ fontSize: 20, fontWeight: 'bold', marginLeft: 10 }}>My Sales Report</Text>
            </View>

            {/* Game Selector */}
            <View style={{ padding: 10 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {games.map(g => (
                        <TouchableOpacity
                            key={g.id}
                            style={[
                                styles.gameChip,
                                selectedGameId === g.id && { backgroundColor: COLORS.primary }
                            ]}
                            onPress={() => setSelectedGameId(g.id)}
                        >
                            <Text style={[
                                styles.chipText,
                                selectedGameId === g.id && { color: '#FFF' }
                            ]}>{g.name}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {loading ? (
                <Text style={{ textAlign: 'center', marginTop: 20 }}>Loading...</Text>
            ) : (
                <FlatList
                    data={groupedTickets()}
                    keyExtractor={(item) => item[0]}
                    renderItem={renderBatch}
                    contentContainerStyle={{ padding: 10 }}
                    ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20, color: '#999' }}>No tickets found for today.</Text>}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    gameChip: {
        paddingHorizontal: 15,
        paddingVertical: 8,
        backgroundColor: '#E0E0E0',
        borderRadius: 20,
        marginRight: 10
    },
    chipText: {
        fontWeight: 'bold',
        color: '#333'
    },
    batchCard: {
        backgroundColor: '#FFF',
        borderRadius: 8,
        padding: 10,
        marginBottom: 10,
        elevation: 1
    },
    batchHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 5,
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
        paddingBottom: 5
    },
    ticketRow: {
        flexDirection: 'row',
        paddingVertical: 2
    }
});
