
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { COLORS } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons'; // Assuming Expo

const { width } = Dimensions.get('window');
const KEY_WIDTH = width / 4 - 6; // 4 columns
const KEY_HEIGHT = 50;

const Key = ({ label, onPress, type = 'number', icon }) => {
    const isAction = type === 'action';
    const isSave = type === 'save';
    const isWhatsapp = type === 'whatsapp';

    let bg = COLORS.secondary;
    if (isAction) bg = COLORS.secondary; // Or slightly different
    if (isSave) bg = '#000000'; // Black save button
    if (isWhatsapp) bg = '#25D366'; // WhatsApp Green

    if (label === 'Clear') return (
        <TouchableOpacity style={[styles.key, { backgroundColor: 'transparent' }]} onPress={onPress}>
            <Text style={[styles.keyText, { color: COLORS.white, fontSize: 16, fontWeight: 'bold' }]}>Clear</Text>
        </TouchableOpacity>
    );

    if (label === 'Clear') return (
        <TouchableOpacity style={[styles.key, { backgroundColor: 'transparent' }]} onPress={onPress}>
            <Text style={[styles.keyText, { color: COLORS.white, fontSize: 16, fontWeight: 'bold' }]}>Clear</Text>
        </TouchableOpacity>
    );

    return (
        <TouchableOpacity
            style={[
                styles.key,
                { backgroundColor: bg, width: isSave ? KEY_WIDTH * 1.2 : KEY_WIDTH } // Save is slightly wider in screenshot? Custom sizing maybe
            ]}
            onPress={onPress}
        >
            {icon ? (
                <Ionicons name={icon} size={24} color="#FFF" />
            ) : (
                <Text style={[styles.keyText, { fontWeight: isSave ? 'bold' : 'normal' }]}>{label}</Text>
            )}
        </TouchableOpacity>
    );
};

export default function CustomKeypad({ onKeyPress, onSave, onClear, onWhatsapp }) {
    const keys = [
        '1', '2', '3', 'X',
        '4', '5', '6', 'Clear',
        '7', '8', '9', 'NEXT',
        'BACK', '0', 'WHATSAPP', 'SAVE'
    ];

    const handlePress = (k) => {
        if (k === 'X') return onKeyPress('X'); // Multiply or special char?
        if (k === 'Clear') return onClear();
        if (k === 'NEXT') return onKeyPress('NEXT');
        if (k === 'BACK') return onKeyPress('BACK');
        if (k === 'WHATSAPP') return onWhatsapp();
        if (k === 'SAVE') return onSave();
        onKeyPress(k);
    };

    return (
        <View style={styles.container}>
            {/* Row 1 */}
            <View style={styles.row}>
                <Key label="1" onPress={() => handlePress('1')} />
                <Key label="2" onPress={() => handlePress('2')} />
                <Key label="3" onPress={() => handlePress('3')} />
                <Key label="X" onPress={() => handlePress('X')} type="action" />
            </View>

            {/* Row 2 */}
            <View style={styles.row}>
                <Key label="4" onPress={() => handlePress('4')} />
                <Key label="5" onPress={() => handlePress('5')} />
                <Key label="6" onPress={() => handlePress('6')} />
                <Key label="Clear" onPress={() => handlePress('Clear')} type="action" />
            </View>

            {/* Row 3 */}
            <View style={styles.row}>
                <Key label="7" onPress={() => handlePress('7')} />
                <Key label="8" onPress={() => handlePress('8')} />
                <Key label="9" onPress={() => handlePress('9')} />
                <TouchableOpacity style={styles.key} onPress={() => handlePress('NEXT')}>
                    <Ionicons name="arrow-forward" size={24} color="#FFF" />
                </TouchableOpacity>
            </View>

            {/* Row 4 */}
            <View style={styles.row}>
                <TouchableOpacity style={styles.key} onPress={() => handlePress('BACK')}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>

                <Key label="0" onPress={() => handlePress('0')} />

                <TouchableOpacity style={[styles.key, { backgroundColor: '#25D366' }]} onPress={() => handlePress('WHATSAPP')}>
                    <Ionicons name="logo-whatsapp" size={24} color="#FFF" />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.key, { backgroundColor: '#000' }]} onPress={() => handlePress('SAVE')}>
                    <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>Save</Text>
                </TouchableOpacity>
            </View>
            <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
            </View >
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.primary, // Blue background for keypad area
        padding: 5,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
        gap: 8,
    },
    key: {
        flex: 1,
        height: 55,
        backgroundColor: COLORS.secondary, // Light Blue keys
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 4,
        elevation: 2,
    },
    keyBlack: {
        flex: 1,
        height: 55,
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 4,
    },
    keySave: {
        flex: 1,
        height: 55,
        backgroundColor: '#000000', // Black Save button as per reference
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 4,
    },
    keyWapp: {
        flex: 1,
        height: 55,
        backgroundColor: '#25D366',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 4,
    },
    keyText: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: '600',
    },
    saveText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    }
});
