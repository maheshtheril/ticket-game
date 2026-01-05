import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS } from '../constants/theme';
import { ticketService } from '../services/ticketService';
import { Ionicons } from '@expo/vector-icons';

export default function GlobalLimitsSettings({ agent }) {
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Matrix Data: { gameId: { max_single: val, ... } }
    const [matrix, setMatrix] = useState({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch all games ordered by draw time (or name)
            const { data, error } = await ticketService.supabase
                .from('game_schedules')
                .select('*')
                .order('name');

            if (error) throw error;

            if (!data || data.length === 0) {
                setGames([]);
                setMatrix({});
            } else {
                const initialMatrix = {};
                data.forEach(g => {
                    initialMatrix[g.id] = {
                        id: g.id,
                        name: g.name,
                        max_single: g.max_single_limit?.toString() || '1000',
                        max_double: g.max_double_limit?.toString() || '500',
                        max_triple_straight: g.max_triple_straight_limit?.toString() || '50',
                        max_triple_box: g.max_triple_box_limit?.toString() || '50',
                        hold_single: g.hold_single_limit?.toString() || '250',
                        hold_double: g.hold_double_limit?.toString() || '100',
                        hold_triple_straight: g.hold_triple_straight_limit?.toString() || '20',
                        hold_triple_box: g.hold_triple_box_limit?.toString() || '20'
                    };
                });
                setGames(data);
                setMatrix(initialMatrix);
            }
        } catch (e) {
            console.error("Error loading limits:", e);
            Alert.alert("Error", "Failed to load game limits.");
        } finally {
            setLoading(false);
        }
    };

    const updateCell = (gameId, field, value) => {
        setMatrix(prev => ({
            ...prev,
            [gameId]: {
                ...prev[gameId],
                [field]: value
            }
        }));
    };

    const applyToAll = (field, value) => {
        if (!value) return;
        Alert.alert(
            "Apply to All?",
            `Set ${field.replace(/_/g, ' ').toUpperCase()} to ${value} for ALL games?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Apply",
                    onPress: () => {
                        setMatrix(prev => {
                            const newMatrix = { ...prev };
                            Object.keys(newMatrix).forEach(key => {
                                newMatrix[key] = { ...newMatrix[key], [field]: value };
                            });
                            return newMatrix;
                        });
                    }
                }
            ]
        );
    };

    const handleSaveAll = async () => {
        setSaving(true);
        try {
            const updates = Object.values(matrix).map(row => ({
                id: row.id,
                max_single_limit: parseInt(row.max_single) || 0,
                max_double_limit: parseInt(row.max_double) || 0,
                max_triple_straight_limit: parseInt(row.max_triple_straight) || 0,
                max_triple_box_limit: parseInt(row.max_triple_box) || 0,
                hold_single_limit: parseInt(row.hold_single) || 0,
                hold_double_limit: parseInt(row.hold_double) || 0,
                hold_triple_straight_limit: parseInt(row.hold_triple_straight) || 0,
                hold_triple_box_limit: parseInt(row.hold_triple_box) || 0,
            }));

            const promises = updates.map(u =>
                ticketService.supabase.from('game_schedules').update(u).eq('id', u.id)
            );

            await Promise.all(promises);
            Alert.alert("Success", "All limits updated successfully!");
            loadData();
        } catch (e) {
            console.error(e);
            // Detect Schema Error
            if (e.message && (e.message.includes('column') || e.message.includes('relation'))) {
                Alert.alert("Database Schema Error", "The database is missing the limits columns.\n\nPlease run 'add_game_limits.sql' in Supabase SQL Editor.");
            } else {
                Alert.alert("Error", "Failed to save limits. " + e.message);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleSeedDefaults = async () => {
        setLoading(true);
        const { error } = await ticketService.seedDefaultGames();
        if (error) Alert.alert("Error", error);
        else {
            Alert.alert("Success", "Default Games Created!");
            loadData();
        }
        setLoading(false);
    };

    // Diagnostics: Check if columns exist by trying a dummy update
    const runDiagnostics = async () => {
        if (games.length === 0) return Alert.alert("No Games", "Cannot run diagnostics without games.");
        const g = games[0];
        try {
            // Try to update one column
            const { error } = await ticketService.supabase
                .from('game_schedules')
                .update({ max_single_limit: 1000 })
                .eq('id', g.id);

            if (error) {
                if (error.message.includes('column') || error.message.includes('does not exist')) {
                    Alert.alert("Diagnostics Failed", "MISSING COLUMNS in Database.\nPlease run SQL script: add_game_limits.sql");
                } else {
                    Alert.alert("Diagnostics Error", error.message);
                }
            } else {
                Alert.alert("Diagnostics Passed", "Database Schema looks correct.");
            }
        } catch (e) {
            Alert.alert("Diagnostics Exception", e.message);
        }
    };

    if (loading) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />;

    return (
        <View style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
            {/* Header */}
            <View style={{ padding: 15, borderBottomWidth: 1, borderBottomColor: '#DDD', backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#2C3E50' }}>Global Limits Matrix</Text>
                    <Text style={{ fontSize: 12, color: '#7F8C8D' }}>Manage Risk & Retention for all draws.</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity onPress={runDiagnostics} style={{ padding: 10 }}>
                        <Ionicons name="construct-outline" size={24} color="#F39C12" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={{ backgroundColor: saving ? '#95A5A6' : '#27AE60', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, flexDirection: 'row', alignItems: 'center' }}
                        onPress={handleSaveAll}
                        disabled={saving || games.length === 0}
                    >
                        {saving ? <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 5 }} /> : <Ionicons name="save-outline" size={18} color="#FFF" style={{ marginRight: 5 }} />}
                        <Text style={{ color: '#FFF', fontWeight: 'bold' }}>SAVE CHANGES</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Empty State */}
            {games.length === 0 && (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 }}>
                    <Ionicons name="calendar-outline" size={60} color="#BDC3C7" />
                    <Text style={{ fontSize: 18, color: '#7F8C8D', marginTop: 10, marginBottom: 20 }}>No Active Game Schedules Found</Text>
                    <TouchableOpacity
                        style={{ backgroundColor: COLORS.primary, padding: 15, borderRadius: 8 }}
                        onPress={handleSeedDefaults}
                    >
                        <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Initialize Default Games</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Matrix Data */}
            {games.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ flexGrow: 1 }}>
                    <View>
                        {/* HEADER ROW */}
                        <View style={styles.headerRow}>
                            <View style={[styles.cell, { width: 140, backgroundColor: '#ECF0F1', borderBottomWidth: 0, justifyContent: 'center' }]}>
                                <Text style={[styles.headerText, { fontSize: 12 }]}>GAME / DRAW</Text>
                            </View>

                            {/* MAIN CAPS GROUP */}
                            <View style={styles.groupHeaderContainer}>
                                <View style={[styles.groupHeader, { backgroundColor: '#E8F6F3' }]}>
                                    <Text style={[styles.groupTitle, { color: '#16A085' }]}>HARD LIMITS (CAPS)</Text>
                                </View>
                                <View style={{ flexDirection: 'row' }}>
                                    <HeaderCell label="Single" code="max_single" onApply={applyToAll} color="#16A085" />
                                    <HeaderCell label="Double" code="max_double" onApply={applyToAll} color="#16A085" />
                                    <HeaderCell label="Tri. Str" code="max_triple_straight" onApply={applyToAll} color="#16A085" />
                                    <HeaderCell label="Tri. Box" code="max_triple_box" onApply={applyToAll} color="#16A085" />
                                </View>
                            </View>

                            {/* HOLD LIMITS GROUP */}
                            <View style={styles.groupHeaderContainer}>
                                <View style={[styles.groupHeader, { backgroundColor: '#FDEDEC' }]}>
                                    <Text style={[styles.groupTitle, { color: '#C0392B' }]}>RETENTION (HOLD)</Text>
                                </View>
                                <View style={{ flexDirection: 'row' }}>
                                    <HeaderCell label="Single" code="hold_single" onApply={applyToAll} color="#C0392B" />
                                    <HeaderCell label="Double" code="hold_double" onApply={applyToAll} color="#C0392B" />
                                    <HeaderCell label="Tri. Str" code="hold_triple_straight" onApply={applyToAll} color="#C0392B" />
                                    <HeaderCell label="Tri. Box" code="hold_triple_box" onApply={applyToAll} color="#C0392B" />
                                </View>
                            </View>
                        </View>

                        <ScrollView style={{ marginBottom: 50 }}>
                            {games.map((game, index) => {
                                const row = matrix[game.id] || {};
                                return (
                                    <View key={game.id} style={[styles.row, index % 2 === 0 ? { backgroundColor: '#FFF' } : { backgroundColor: '#F9F9F9' }]}>
                                        <View style={[styles.cell, { width: 140, justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 10 }]}>
                                            <Text style={{ fontWeight: 'bold', color: '#34495E', fontSize: 13 }}>{game.name}</Text>
                                            <Text style={{ fontSize: 10, color: '#95A5A6' }}>{new Date('2000-01-01T' + game.draw_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                        </View>

                                        {/* MAX CAPS */}
                                        <InputCell value={row.max_single} onChange={v => updateCell(game.id, 'max_single', v)} />
                                        <InputCell value={row.max_double} onChange={v => updateCell(game.id, 'max_double', v)} />
                                        <InputCell value={row.max_triple_straight} onChange={v => updateCell(game.id, 'max_triple_straight', v)} />
                                        <InputCell value={row.max_triple_box} onChange={v => updateCell(game.id, 'max_triple_box', v)} />

                                        {/* HOLD LIMITS */}
                                        <InputCell value={row.hold_single} onChange={v => updateCell(game.id, 'hold_single', v)} highlight />
                                        <InputCell value={row.hold_double} onChange={v => updateCell(game.id, 'hold_double', v)} highlight />
                                        <InputCell value={row.hold_triple_straight} onChange={v => updateCell(game.id, 'hold_triple_straight', v)} highlight />
                                        <InputCell value={row.hold_triple_box} onChange={v => updateCell(game.id, 'hold_triple_box', v)} highlight />
                                    </View>
                                );
                            })}
                        </ScrollView>
                    </View>
                </ScrollView>
            )}
        </View>
    );
}

const HeaderCell = ({ label, code, onApply, color }) => (
    <View style={[styles.cell, { backgroundColor: color + '08', height: 50, justifyContent: 'space-between', paddingVertical: 5 }]}>
        <Text style={[styles.headerText, { color }]}>{label}</Text>
        <TouchableOpacity onPress={() => Alert.prompt(`Bulk Set ${label}`, `Enter value to apply to ALL games:`, t => t && onApply(code, t))}>
            <Ionicons name="arrow-down-circle" size={20} color={color} style={{ opacity: 0.8 }} />
        </TouchableOpacity>
    </View>
);

const InputCell = ({ value, onChange, highlight }) => (
    <View style={styles.cell}>
        <TextInput
            style={[styles.input, highlight ? styles.inputHighlight : null]}
            value={value}
            onChangeText={onChange}
            keyboardType="numeric"
            selectTextOnFocus
        />
    </View>
);

const styles = StyleSheet.create({
    headerRow: {
        flexDirection: 'row',
        borderBottomWidth: 2,
        borderBottomColor: '#BDC3C7',
        backgroundColor: '#F4F6F6'
    },
    groupHeaderContainer: {

    },
    groupHeader: {
        alignItems: 'center',
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)'
    },
    groupTitle: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1
    },
    row: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#ECF0F1',
        height: 45,
        alignItems: 'center'
    },
    cell: {
        width: 85,
        padding: 4,
        justifyContent: 'center',
        alignItems: 'center',
        borderRightWidth: 1,
        borderRightColor: '#ECF0F1'
    },
    headerText: {
        fontSize: 11,
        fontWeight: 'bold',
        textAlign: 'center'
    },
    input: {
        width: '100%',
        height: 34,
        borderWidth: 1,
        borderColor: '#D7DBDD',
        borderRadius: 4,
        textAlign: 'center',
        paddingHorizontal: 0,
        backgroundColor: '#FFF',
        fontSize: 13,
        color: '#2C3E50'
    },
    inputHighlight: {
        borderColor: '#E6B0AA',
        backgroundColor: '#FDEDEC',
        color: '#C0392B',
        fontWeight: 'bold'
    }
});
