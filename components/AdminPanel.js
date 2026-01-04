
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, TextInput, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ticketService } from '../services/ticketService';
import { COLORS } from '../constants/theme';

export default function AdminPanel({ agent, onBack, onNavigate, setEditingUser, setActiveUserTab }) {
    const [adminTab, setAdminTab] = useState('draws');
    const [allGames, setAllGames] = useState([]);

    // Time Settings State
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'timeSettings'
    const [editingGame, setEditingGame] = useState(null);
    const [timeForm, setTimeForm] = useState({
        closeTime: '',
        fillTime: '',
        deletionTime: '',
        openTime: ''
    });

    useEffect(() => {
        loadAllGames();
    }, []);

    const loadAllGames = async () => {
        try {
            const { data } = await ticketService.getActiveGames();
            setAllGames(data || []);
        } catch (e) {
            console.error("Failed to load games", e);
        }
    };

    const toggleGame = async (id, currentStatus) => {
        const { error } = await ticketService.toggleGameStatus(id, !currentStatus);
        if (error) Alert.alert('Error', 'Error updating game');
        else loadAllGames();
    };

    // Helper: Convert "13:00:00" -> "01:00 PM"
    const formatTimeForDisplay = (timeStr) => {
        if (!timeStr || typeof timeStr !== 'string') return '';
        // Check if already 12h format (simple heuristic)
        if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;

        try {
            // Check if format is HH:mm:ss OR HH:mm
            const parts = timeStr.split(':');
            if (parts.length >= 2) {
                const hours = parseInt(parts[0]);
                const minutes = parseInt(parts[1]);
                if (!isNaN(hours) && !isNaN(minutes)) {
                    const date = new Date();
                    date.setHours(hours, minutes);
                    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                }
            }
        } catch (e) { }

        return timeStr;
    };

    // Helper: Convert "01:00 PM" -> "13:00"
    const formatTimeForDB = (timeStr) => {
        if (!timeStr) return null;
        if (timeStr.includes(':') && !timeStr.includes('M')) return timeStr; // Already 24h (approx)

        try {
            const date = new Date(`1/1/2000 ${timeStr}`);
            if (isNaN(date.getTime())) return timeStr; // Fallback
            // Return HH:mm
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
        } catch (e) {
            return timeStr;
        }
    };

    const openTimeSettings = async (gameObj) => {
        // Fetch fresh data safely
        let freshGame = null;
        if (ticketService.getGameById) {
            try {
                const { data } = await ticketService.getGameById(gameObj.id);
                freshGame = data;
            } catch (e) { console.error(e); }
        }
        const game = freshGame || gameObj;

        setEditingGame(game);
        setTimeForm({
            closeTime: formatTimeForDisplay(game.close_time),
            fillTime: formatTimeForDisplay(game.fill_time),
            deletionTime: formatTimeForDisplay(game.deletion_time),
            openTime: formatTimeForDisplay(game.open_time)
        });
        setViewMode('timeSettings');
    };

    const handleSaveTimeSettings = async () => {
        // Convert display times back to DB format
        const dbSettings = {
            close_time: formatTimeForDB(timeForm.closeTime),
            fill_time: formatTimeForDB(timeForm.fillTime),
            deletion_time: formatTimeForDB(timeForm.deletionTime),
            open_time: formatTimeForDB(timeForm.openTime)
        };

        const { error } = await ticketService.updateGameSettings(editingGame.id, dbSettings);

        if (error) Alert.alert('Error', error.message);
        else {
            Alert.alert('Success', 'Updated Successfully');
            loadAllGames();
            setViewMode('list');
        }
    };

    if (viewMode === 'timeSettings') {
        let drawTimeStr = 'Unknown';
        try {
            const dt = new Date(`2000-01-01T${editingGame.draw_time}`);
            if (!isNaN(dt.getTime())) {
                drawTimeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
            } else {
                // Fallback if draw_time is full ISO string or other format
                const dt2 = new Date(editingGame.draw_time);
                if (!isNaN(dt2.getTime())) {
                    drawTimeStr = dt2.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                } else {
                    drawTimeStr = editingGame.draw_time; // Just show raw string
                }
            }
        } catch (e) { drawTimeStr = editingGame.draw_time; }

        return (
            <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
                {/* Header for Time Settings */}
                <View style={{ height: 60, backgroundColor: '#2E7D32', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, elevation: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TouchableOpacity onPress={() => setViewMode('list')}>
                            <Ionicons name="arrow-back" size={28} color="#FFF" style={{ marginRight: 15 }} />
                        </TouchableOpacity>
                        <View>
                            <Text style={{ fontSize: 18, color: '#FFF', fontWeight: 'bold' }}>{editingGame.name}</Text>
                            <Text style={{ fontSize: 14, color: '#C8E6C9' }}>Draw: {drawTimeStr}</Text>
                        </View>
                    </View>
                    <Ionicons name="timer" size={24} color="#FFF" />
                </View>

                <ScrollView style={{ flex: 1, padding: 15 }}>
                    <Text style={{ fontSize: 16, color: '#666', marginBottom: 20, fontStyle: 'italic' }}>
                        Enter times in 12-hour format (e.g. "01:00 PM"). Leave blank if not applicable.
                    </Text>

                    <View style={{ marginBottom: 15 }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#333' }}>Close Time</Text>
                        <TextInput
                            style={styles.input}
                            value={timeForm.closeTime}
                            onChangeText={t => setTimeForm({ ...timeForm, closeTime: t })}
                            placeholder="e.g. 12:55 PM"
                            placeholderTextColor="#999"
                        />
                        <Text style={{ color: '#666', marginTop: 5, fontSize: 12 }}>Booking stops at this time.</Text>
                    </View>

                    <View style={{ marginBottom: 15 }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#333' }}>Fill Time</Text>
                        <TextInput
                            style={styles.input}
                            value={timeForm.fillTime}
                            onChangeText={t => setTimeForm({ ...timeForm, fillTime: t })}
                            placeholder="e.g. 01:05 PM"
                            placeholderTextColor="#999"
                        />
                    </View>

                    <View style={{ marginBottom: 15 }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#333' }}>Last Deletion Time</Text>
                        <TextInput
                            style={styles.input}
                            value={timeForm.deletionTime}
                            onChangeText={t => setTimeForm({ ...timeForm, deletionTime: t })}
                            placeholder="e.g. 12:58 PM"
                            placeholderTextColor="#999"
                        />
                    </View>

                    <View style={{ marginBottom: 15 }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#333' }}>Open Time (Next Day?)</Text>
                        <TextInput
                            style={styles.input}
                            value={timeForm.openTime}
                            onChangeText={t => setTimeForm({ ...timeForm, openTime: t })}
                            placeholder="e.g. 02:00 PM"
                            placeholderTextColor="#999"
                        />
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 40 }}>
                        <TouchableOpacity
                            style={{ flex: 1, backgroundColor: '#2E7D32', paddingVertical: 15, borderRadius: 8, alignItems: 'center', elevation: 3 }}
                            onPress={handleSaveTimeSettings}
                        >
                            <Text style={{ color: '#FFF', fontSize: 18, fontWeight: 'bold' }}>UPDATE SETTINGS</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
            {/* Header */}
            <View style={{ padding: 15, backgroundColor: '#607D8B', flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={onBack}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={{ color: '#FFF', fontSize: 20, fontWeight: 'bold', marginLeft: 15 }}>Admin Panel</Text>
            </View>

            {/* Tabs */}
            <View style={{ flexDirection: 'row', backgroundColor: '#FFF' }}>
                <TouchableOpacity
                    style={{ flex: 1, padding: 15, borderBottomWidth: adminTab === 'draws' ? 3 : 0, borderBottomColor: '#607D8B' }}
                    onPress={() => setAdminTab('draws')}
                >
                    <Text style={{ textAlign: 'center', fontWeight: 'bold', color: adminTab === 'draws' ? '#607D8B' : '#888' }}>Draws</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={{ flex: 1, padding: 15, borderBottomWidth: adminTab === 'times' ? 3 : 0, borderBottomColor: '#607D8B' }}
                    onPress={() => setAdminTab('times')}
                >
                    <Text style={{ textAlign: 'center', fontWeight: 'bold', color: adminTab === 'times' ? '#607D8B' : '#888' }}>Time Settings</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={{ flex: 1, padding: 15, borderBottomWidth: adminTab === 'globalLimits' ? 3 : 0, borderBottomColor: '#607D8B' }}
                    onPress={() => setAdminTab('globalLimits')}
                >
                    <Text style={{ textAlign: 'center', fontWeight: 'bold', color: adminTab === 'globalLimits' ? '#607D8B' : '#888' }}>Limits</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={{ flex: 1, padding: 15, borderBottomWidth: adminTab === 'exposure' ? 3 : 0, borderBottomColor: '#607D8B' }}
                    onPress={() => setAdminTab('exposure')}
                >
                    <Text style={{ textAlign: 'center', fontWeight: 'bold', color: adminTab === 'exposure' ? '#607D8B' : '#888' }}>Exposure</Text>
                </TouchableOpacity>
            </View>

            <View style={{ flex: 1, padding: 15 }}>
                {adminTab === 'draws' && (
                    <ScrollView>
                        <Text style={{ marginBottom: 10, color: '#666' }}>Active draws will be available for betting.</Text>
                        {allGames.map(g => (
                            <View key={g.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#FFF', marginBottom: 10, borderRadius: 8, elevation: 2 }}>
                                <View>
                                    <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{g.name || 'Draw'}</Text>
                                    <Text style={{ color: '#666' }}>{new Date(g.draw_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Switch
                                        value={g.is_active}
                                        onValueChange={() => toggleGame(g.id, g.is_active)}
                                        trackColor={{ false: "#767577", true: "#81b0ff" }}
                                        thumbColor={g.is_active ? "#2196F3" : "#f4f3f4"}
                                    />
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                )}

                {adminTab === 'times' && (
                    <ScrollView>
                        <Text style={{ marginBottom: 15, color: '#555', fontStyle: 'italic', paddingHorizontal: 5 }}>
                            Manage Open, Close, and Result times for each game schedule.
                        </Text>
                        {allGames.map(g => (
                            <TouchableOpacity
                                key={g.id}
                                onPress={() => openTimeSettings(g)}
                                style={{ backgroundColor: '#FFF', padding: 15, marginBottom: 10, borderRadius: 8, elevation: 2, borderLeftWidth: 5, borderLeftColor: '#2E7D32' }}
                            >
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                                    <Text style={{ fontWeight: 'bold', fontSize: 18, color: '#333' }}>{g.name}</Text>
                                    <Ionicons name="create-outline" size={24} color="#2E7D32" />
                                </View>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 15 }}>
                                    <Text style={{ color: '#555' }}>Close: <Text style={{ fontWeight: 'bold' }}>{formatTimeForDisplay(g.close_time) || '--:--'}</Text></Text>
                                    <Text style={{ color: '#555' }}>Fill: <Text style={{ fontWeight: 'bold' }}>{formatTimeForDisplay(g.fill_time) || '--:--'}</Text></Text>
                                    <Text style={{ color: '#555' }}>Open: <Text style={{ fontWeight: 'bold' }}>{formatTimeForDisplay(g.open_time) || '--:--'}</Text></Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}

                {adminTab === 'globalLimits' && (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, color: '#555', textAlign: 'center', marginBottom: 20 }}>
                            To manage Global Limits, please edit your own profile limits in the 'Manage Users' section.
                            Values set on the Admin account act as the system-wide maximums.
                        </Text>
                        <TouchableOpacity
                            style={{ backgroundColor: COLORS.primary, padding: 12, borderRadius: 8, marginBottom: 20 }}
                            onPress={() => {
                                setEditingUser(agent); // Set Admin as editing user
                                setActiveUserTab('limits');
                                onNavigate('users'); // Redirect to user edit view
                            }}
                        >
                            <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Go to Admin Limits</Text>
                        </TouchableOpacity>

                        <Text style={{ marginTop: 20, color: '#888', fontStyle: 'italic' }}>
                            For Risk Management & Offload Reports, see the "Exposure" tab.
                        </Text>
                    </View>
                )}

                {adminTab === 'exposure' && (
                    <ExposureReport allGames={allGames} />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    input: {
        borderWidth: 1,
        borderColor: '#CCC',
        padding: 10,
        marginTop: 5,
        borderRadius: 4,
        backgroundColor: '#FFF',
        fontSize: 16
    }
});

function ExposureReport({ allGames }) {
    const [selectedGameId, setSelectedGameId] = useState(null);
    const [report, setReport] = useState([]);
    const [loading, setLoading] = useState(false);

    // Admin Retention Settings (Read-Only reference basically, fetched from DB ideally)
    const [retentionSettings, setRetentionSettings] = useState({
        'single': 250,
        'double': 100,
        'triple_straight': 20,
        'triple_box': 20
    });

    useEffect(() => {
        // Fetch Admin's Hold Limits
        const loadLimits = async () => {
            try {
                const { data: adminUser } = await ticketService.supabase.from('users').select('id').eq('role', 'admin').maybeSingle();
                if (adminUser) {
                    const { data: lim } = await ticketService.supabase.from('user_limits').select('*').eq('user_id', adminUser.id).single();
                    if (lim) {
                        setRetentionSettings({
                            'single': lim.hold_single_number_count || 250,
                            'double': lim.hold_double_number_count || 100,
                            'triple_straight': lim.hold_triple_straight_count || 20,
                            'triple_box': lim.hold_triple_box_count || 20
                        });
                    }
                }
            } catch (e) { console.error(e); }
        };
        loadLimits();
    }, []);

    const runReport = async () => {
        if (!selectedGameId) {
            Alert.alert("Select Game", "Please select a game first.");
            return;
        }
        setLoading(true);
        try {
            // 1. Get Draw ID
            const today = new Date().toISOString().split('T')[0];
            let { data: draw } = await ticketService.supabase
                .from('daily_draws').select('id').eq('schedule_id', selectedGameId).eq('draw_date', today).maybeSingle();

            if (!draw) {
                setReport([]);
                Alert.alert("No Data", "No draw found for today.");
                setLoading(false);
                return;
            }

            // 2. Fetch Active Tickets
            const { data: tickets } = await ticketService.supabase
                .from('tickets')
                .select('ticket_number, ticket_type, count')
                .eq('draw_id', draw.id)
                .eq('status', 'active');

            // 3. Aggregate
            const counts = {}; // Key: "123_triple_straight" -> { number, type, total }
            tickets.forEach(t => {
                const k = `${t.ticket_number}_${t.ticket_type}`;
                if (!counts[k]) counts[k] = { number: t.ticket_number, type: t.ticket_type, total: 0 };
                counts[k].total += t.count;
            });

            // 4. Compare vs Retention
            const result = [];
            Object.values(counts).forEach(row => {
                const limit = retentionSettings[row.type] || 9999;
                if (row.total > limit) {
                    result.push({
                        item: `${row.number} (${row.type.replace('_', ' ').toUpperCase()})`,
                        total: row.total,
                        excess: row.total - limit,
                        limitVal: limit
                    });
                }
            });

            setReport(result.sort((a, b) => b.excess - a.excess));

        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to generate report");
        }
        setLoading(false);
    };

    return (
        <ScrollView>
            <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>1. Select Game</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                {allGames.map(g => (
                    <TouchableOpacity
                        key={g.id}
                        style={{ padding: 10, backgroundColor: selectedGameId === g.id ? COLORS.primary : '#EEE', borderRadius: 8 }}
                        onPress={() => setSelectedGameId(g.id)}
                    >
                        <Text style={{ color: selectedGameId === g.id ? '#FFF' : '#333' }}>{g.name}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={{ backgroundColor: '#E3F2FD', padding: 15, borderRadius: 8, marginBottom: 20 }}>
                <Text style={{ fontWeight: 'bold', color: '#1565C0', marginBottom: 5 }}>Current Retention Limits (Hold)</Text>
                <Text style={{ fontSize: 12, color: '#555' }}>To change these, go to "Limits" tab and edit Admin Profile.</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
                    <Text style={{ width: '50%', fontSize: 13 }}>Single: <Text style={{ fontWeight: 'bold' }}>{retentionSettings.single}</Text></Text>
                    <Text style={{ width: '50%', fontSize: 13 }}>Double: <Text style={{ fontWeight: 'bold' }}>{retentionSettings.double}</Text></Text>
                    <Text style={{ width: '50%', fontSize: 13 }}>3-Straight: <Text style={{ fontWeight: 'bold' }}>{retentionSettings.triple_straight}</Text></Text>
                    <Text style={{ width: '50%', fontSize: 13 }}>3-Box: <Text style={{ fontWeight: 'bold' }}>{retentionSettings.triple_box}</Text></Text>
                </View>
            </View>

            <TouchableOpacity
                style={{ backgroundColor: '#FF9800', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 20 }}
                onPress={runReport}
            >
                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>GENERATE OFFLOAD REPORT</Text>
            </TouchableOpacity>

            {loading && <Text style={{ textAlign: 'center', margin: 20 }}>Generating...</Text>}

            {!loading && report.length > 0 && (
                <View>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#D32F2F' }}>Items to Offload ({report.length})</Text>
                    <View style={{ backgroundColor: '#FFF', borderRadius: 8, overflow: 'hidden' }}>
                        <View style={{ flexDirection: 'row', backgroundColor: '#EEE', padding: 10 }}>
                            <Text style={{ flex: 3, fontWeight: 'bold' }}>Number (Type)</Text>
                            <Text style={{ flex: 1, fontWeight: 'bold', textAlign: 'center' }}>Total</Text>
                            <Text style={{ flex: 1, fontWeight: 'bold', textAlign: 'center', color: '#D32F2F' }}>Excess</Text>
                        </View>
                        {report.map((r, i) => (
                            <View key={i} style={{ flexDirection: 'row', padding: 10, borderBottomWidth: 1, borderBottomColor: '#EEE' }}>
                                <Text style={{ flex: 3, fontSize: 13 }}>{r.item}</Text>
                                <Text style={{ flex: 1, textAlign: 'center' }}>{r.total}</Text>
                                <Text style={{ flex: 1, textAlign: 'center', fontWeight: 'bold', color: '#D32F2F' }}>{r.excess}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}
            {!loading && report.length === 0 && selectedGameId && (
                <Text style={{ textAlign: 'center', color: '#666', marginTop: 20 }}>All sales are within retention limits.</Text>
            )}
        </ScrollView>
    );
}
