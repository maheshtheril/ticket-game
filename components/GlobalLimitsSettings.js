import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import { ticketService } from '../services/ticketService';

export default function GlobalLimitsSettings() {
    const [limits, setLimits] = useState({
        max_single: '', max_double: '', max_triple_straight: '', max_triple_box: '',
        hold_single: '', hold_double: '', hold_triple_straight: '', hold_triple_box: ''
    });

    useEffect(() => {
        loadGlobalLimits();
    }, []);

    const loadGlobalLimits = async () => {
        try {
            // 1. Get Admin User
            const { data: admin } = await ticketService.supabase.from('users').select('id').eq('role', 'admin').single();
            if (!admin) return;

            // 2. Get Limits
            const { data: lim } = await ticketService.supabase.from('user_limits').select('*').eq('user_id', admin.id).single();
            if (lim) {
                setLimits({
                    max_single: lim.max_single_number_count?.toString() || '',
                    max_double: lim.max_double_number_count?.toString() || '',
                    max_triple_straight: lim.max_triple_straight_count?.toString() || '',
                    max_triple_box: lim.max_triple_box_count?.toString() || '',
                    hold_single: lim.hold_single_number_count?.toString() || '',
                    hold_double: lim.hold_double_number_count?.toString() || '',
                    hold_triple_straight: lim.hold_triple_straight_count?.toString() || '',
                    hold_triple_box: lim.hold_triple_box_count?.toString() || ''
                });
            }
        } catch (e) { console.error(e); }
    };

    const handleSave = async () => {
        try {
            const { data: admin } = await ticketService.supabase.from('users').select('id').eq('role', 'admin').single();
            if (!admin) return;

            const payload = {
                max_single_number_count: parseInt(limits.max_single) || null,
                max_double_number_count: parseInt(limits.max_double) || null,
                max_triple_straight_count: parseInt(limits.max_triple_straight) || null,
                max_triple_box_count: parseInt(limits.max_triple_box) || null,
                hold_single_number_count: parseInt(limits.hold_single) || null,
                hold_double_number_count: parseInt(limits.hold_double) || null,
                hold_triple_straight_count: parseInt(limits.hold_triple_straight) || null,
                hold_triple_box_count: parseInt(limits.hold_triple_box) || null,
            };

            const { error } = await ticketService.supabase.from('user_limits').upsert({ user_id: admin.id, ...payload }, { onConflict: 'user_id' });

            if (error) Alert.alert("Error", error.message);
            else Alert.alert("Success", "Global Limits Updated!");

        } catch (e) { Alert.alert("Error", e.message); }
    };

    const update = (field, val) => setLimits(p => ({ ...p, [field]: val }));

    return (
        <ScrollView style={{ padding: 15, backgroundColor: '#FFF' }}>
            <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 15, color: COLORS.primary }}>Global Main Count Limits (Hard Cap)</Text>
            <Text style={{ fontSize: 12, color: '#666', marginBottom: 15 }}>Max total sales allowed system-wide. No user can exceed this.</Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                <View style={{ width: '48%' }}>
                    <Text style={{ fontWeight: 'bold' }}>Single</Text>
                    <TextInput style={styles.input} value={limits.max_single} onChangeText={t => update('max_single', t)} keyboardType="numeric" />
                </View>
                <View style={{ width: '48%' }}>
                    <Text style={{ fontWeight: 'bold' }}>Double</Text>
                    <TextInput style={styles.input} value={limits.max_double} onChangeText={t => update('max_double', t)} keyboardType="numeric" />
                </View>
                <View style={{ width: '48%' }}>
                    <Text style={{ fontWeight: 'bold' }}>Triple Straight</Text>
                    <TextInput style={styles.input} value={limits.max_triple_straight} onChangeText={t => update('max_triple_straight', t)} keyboardType="numeric" />
                </View>
                <View style={{ width: '48%' }}>
                    <Text style={{ fontWeight: 'bold' }}>Triple Box</Text>
                    <TextInput style={styles.input} value={limits.max_triple_box} onChangeText={t => update('max_triple_box', t)} keyboardType="numeric" />
                </View>
            </View>

            <View style={{ height: 1, backgroundColor: '#CCC', marginVertical: 10 }} />

            <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 15, color: '#E65100' }}>Global Hold Count Limits (Retention)</Text>
            <Text style={{ fontSize: 12, color: '#666', marginBottom: 15 }}>Sales retention threshold. Excess goes to Offload Report.</Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 30 }}>
                <View style={{ width: '48%' }}>
                    <Text style={{ fontWeight: 'bold' }}>Hold Single</Text>
                    <TextInput style={styles.input} value={limits.hold_single} onChangeText={t => update('hold_single', t)} keyboardType="numeric" />
                </View>
                <View style={{ width: '48%' }}>
                    <Text style={{ fontWeight: 'bold' }}>Hold Double</Text>
                    <TextInput style={styles.input} value={limits.hold_double} onChangeText={t => update('hold_double', t)} keyboardType="numeric" />
                </View>
                <View style={{ width: '48%' }}>
                    <Text style={{ fontWeight: 'bold' }}>Hold 3-Str</Text>
                    <TextInput style={styles.input} value={limits.hold_triple_straight} onChangeText={t => update('hold_triple_straight', t)} keyboardType="numeric" />
                </View>
                <View style={{ width: '48%' }}>
                    <Text style={{ fontWeight: 'bold' }}>Hold 3-Box</Text>
                    <TextInput style={styles.input} value={limits.hold_triple_box} onChangeText={t => update('hold_triple_box', t)} keyboardType="numeric" />
                </View>
            </View>

            <TouchableOpacity
                style={{ backgroundColor: COLORS.primary, padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 50 }}
                onPress={handleSave}
            >
                <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>UPDATE GLOBAL SETTINGS</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    input: {
        borderWidth: 1,
        borderColor: '#CCC',
        borderRadius: 4,
        padding: 8,
        marginTop: 5,
        backgroundColor: '#F9F9F9',
        fontSize: 16
    }
});
