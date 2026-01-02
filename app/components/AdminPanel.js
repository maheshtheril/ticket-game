
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
        if (!timeStr) return '';
        // Check if already 12h format (simple heuristic)
        if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;

        try {
            // Create a dummy date with this time
            const [hours, minutes] = timeStr.split(':');
            const date = new Date();
            date.setHours(parseInt(hours), parseInt(minutes));
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        } catch (e) {
            return timeStr;
        }
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
        const drawTimeStr = new Date(editingGame.draw_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

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
                    <Text style={{ textAlign: 'center', fontWeight: 'bold', color: adminTab === 'draws' ? '#607D8B' : '#888' }}>Draw Management</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={{ flex: 1, padding: 15, borderBottomWidth: adminTab === 'globalLimits' ? 3 : 0, borderBottomColor: '#607D8B' }}
                    onPress={() => setAdminTab('globalLimits')}
                >
                    <Text style={{ textAlign: 'center', fontWeight: 'bold', color: adminTab === 'globalLimits' ? '#607D8B' : '#888' }}>Global Limits</Text>
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
                                    <TouchableOpacity onPress={() => openTimeSettings(g)} style={{ marginRight: 15, flexDirection: 'row', alignItems: 'center', backgroundColor: '#E0F7FA', padding: 5, borderRadius: 4 }}>
                                        <Ionicons name="timer-outline" size={24} color="#006064" />
                                        <Text style={{ marginLeft: 5, color: '#006064', fontWeight: 'bold' }}>Time Settings</Text>
                                    </TouchableOpacity>
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

                {adminTab === 'globalLimits' && (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, color: '#555', textAlign: 'center', marginBottom: 20 }}>
                            To manage Global Limits, please edit your own profile limits in the 'Manage Users' section.
                            Values set on the Admin account act as the system-wide maximums.
                        </Text>
                        <TouchableOpacity
                            style={{ backgroundColor: COLORS.primary, padding: 12, borderRadius: 8 }}
                            onPress={() => {
                                setEditingUser(agent); // Set Admin as editing user
                                setActiveUserTab('limits');
                                onNavigate('users'); // Redirect to user edit view
                            }}
                        >
                            <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Go to Admin Limits</Text>
                        </TouchableOpacity>
                    </View>
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
