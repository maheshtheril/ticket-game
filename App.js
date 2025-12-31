
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CustomKeypad from './components/CustomKeypad';
import { COLORS } from './constants/theme';
import { ticketService } from './services/ticketService'; // Using the Mock service now

export default function App() {
  const [tickets, setTickets] = useState([]);
  const [currentTab, setCurrentTab] = useState(2);
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState('DEAR-1 PM');
  const [agent, setAgent] = useState('demo_agent');

  // Input States
  const [number, setNumber] = useState('');
  const [startNumber, setStartNumber] = useState('');
  const [endNumber, setEndNumber] = useState('');
  const [count, setCount] = useState('');
  const [focusedField, setFocusedField] = useState('number');

  const maxNumberLength = currentTab;

  const [checks, setChecks] = useState({
    any: false,
    set: false,
    c100: false,
    c111: false
  });

  // Load Games (Mock)
  React.useEffect(() => {
    loadGames();
  }, []);

  const loadGames = async () => {
    const { data } = await ticketService.getActiveGames();
    if (data && data.length > 0) {
      setGames(data);
      setSelectedGame(data[0].name);
    }
  };

  const getButtonLabels = () => {
    if (currentTab === 1) return { A: 'A', B: 'B', C: 'C', All: 'ALL' };
    if (currentTab === 2) return { A: 'AB', B: 'AC', C: 'BC', All: 'ALL' };
    if (currentTab === 3) return { A: 'SUPER', B: 'BOX', C: null, All: 'ALL' };
    return { A: 'A', B: 'B', C: 'C', All: 'ALL' };
  };
  const btnLabels = getButtonLabels();

  const totalCount = tickets.reduce((sum, t) => sum + (parseInt(t.count) || 0), 0);
  const totalRs = tickets.reduce((sum, t) => sum + (t.total || 0), 0);

  const handleKeyPress = (key) => {
    if (key === 'BACK') return;
    if (key === 'NEXT') return;

    if (focusedField === 'number') {
      if (number.length >= maxNumberLength) return;
      const newNum = number + key;
      setNumber(newNum);
      if (newNum.length === maxNumberLength) setFocusedField('count');
    } else if (focusedField === 'start') {
      if (startNumber.length >= maxNumberLength) return;
      const newNum = startNumber + key;
      setStartNumber(newNum);
      if (newNum.length === maxNumberLength) setFocusedField('end');
    } else if (focusedField === 'end') {
      if (endNumber.length >= maxNumberLength) return;
      const newNum = endNumber + key;
      setEndNumber(newNum);
      if (newNum.length === maxNumberLength) setFocusedField('count');
    } else if (focusedField === 'count') {
      setCount(prev => prev + key);
    }
  };

  const handleClear = () => {
    setNumber('');
    setStartNumber('');
    setEndNumber('');
    setCount('');
    setFocusedField(checks.any ? 'start' : 'number');
  };

  const handleTabChange = (tab) => {
    setCurrentTab(tab);
    setNumber('');
    setCount('');
    setFocusedField('number');
  };

  const handleAddTicket = (typeLabel) => {
    // Validation
    const isAny = checks.any;
    if (isAny) {
      if (!startNumber || !endNumber || !count) return;
    } else {
      if (!number || !count) return;
    }

    let ticketsToCreate = [];

    // Determine loop range
    let loopStart, loopEnd;
    if (isAny) {
      loopStart = parseInt(startNumber);
      loopEnd = parseInt(endNumber);
      if (isNaN(loopStart) || isNaN(loopEnd) || loopStart > loopEnd) {
        alert('Invalid Range');
        return;
      }
    }

    let typesToAdd = [];
    if (typeLabel === 'ALL') {
      if (currentTab === 1) typesToAdd = [btnLabels.A, btnLabels.B, btnLabels.C];
      if (currentTab === 2) typesToAdd = [btnLabels.A, btnLabels.B, btnLabels.C];
      if (currentTab === 3) typesToAdd = [btnLabels.A, btnLabels.B];
    } else {
      typesToAdd = [typeLabel];
    }

    // Generate Tickets
    const generateForNumber = (numStr) => {
      return typesToAdd.map(type => ({
        id: Date.now().toString() + Math.random(),
        name: selectedGame.replace('D-', '').split(':')[0] + ' ' + type,
        number: numStr,
        count: count,
        total: parseInt(count) * 10,
        boxType: type,
        color: getTypeColor(type)
      }));
    };

    if (isAny) {
      for (let i = loopStart; i <= loopEnd; i++) {
        // Pad with leading zeros if needed based on maxNumberLength
        let numStr = i.toString().padStart(maxNumberLength, '0');
        ticketsToCreate = [...ticketsToCreate, ...generateForNumber(numStr)];
      }
    } else {
      ticketsToCreate = generateForNumber(number);
    }

    setTickets([...ticketsToCreate, ...tickets]);
    handleClear();
  };

  // Helper to get color
  const getTypeColor = (type) => {
    if (type === btnLabels.A) return COLORS.btnGreen;
    if (type === btnLabels.B) return COLORS.btnPink;
    if (type === btnLabels.C) return COLORS.btnOrange;
    return 'black';
  };

  const handleSave = async () => {
    if (tickets.length === 0) {
      alert('No tickets to save!');
      return;
    }

    // Mock Save
    const { error } = await ticketService.buyTicket(tickets, 1);

    if (error) {
      alert('Error saving: ' + error.message);
    } else {
      alert('Saved Successfully!');
      setTickets([]);
    }
  };

  const renderTicketItem = ({ item }) => (
    <View style={styles.ticketRow}>
      <Text style={[styles.ticketText, { color: item.color, flex: 2 }]}>{item.name}</Text>
      <Text style={[styles.ticketText, { color: item.color, flex: 1 }]}>{item.number}</Text>
      <Text style={[styles.ticketText, { color: item.color, flex: 1 }]}>{item.count}</Text>
      <Text style={[styles.ticketText, { color: item.color, flex: 1 }]}>{item.total}</Text>
      <TouchableOpacity onPress={() => { }}>
        <Ionicons name="trash-outline" size={20} color="#666" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />

      <View style={styles.header}>
        <Text style={styles.statLabel}>COUNT : {totalCount}</Text>
        <Text style={styles.statLabel}>Rs : {totalRs}</Text>

        <View style={styles.tabsContainer}>
          {[1, 2, 3].map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, currentTab === tab && styles.activeTab]}
              onPress={() => handleTabChange(tab)}
            >
              <Text style={[styles.tabText, currentTab === tab && styles.activeTabText]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputText}>{selectedGame}</Text>
          <Ionicons name="caret-down" size={16} color="#666" />
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputText}>{agent}</Text>
          <Ionicons name="caret-down" size={16} color="#666" />
        </View>

        <View style={styles.checkboxRow}>
          <Checkbox
            label="Any"
            checked={checks.any}
            onPress={() => {
              const newVal = !checks.any;
              setChecks(p => ({ ...p, any: newVal }));
              setFocusedField(newVal ? 'start' : 'number');
              setNumber(''); setStartNumber(''); setEndNumber('');
            }}
          />
          <Checkbox label="Set" checked={checks.set} />
          <Checkbox label="100" checked={checks.c100} />
          <Checkbox label="111" checked={checks.c111} />
        </View>

        <View style={styles.inputsRow}>
          {!checks.any ? (
            <TouchableOpacity
              style={[
                styles.inputField,
                { flex: 1, marginRight: 5, borderColor: focusedField === 'number' ? COLORS.primary : '#CCC', borderWidth: focusedField === 'number' ? 2 : 1 }
              ]}
              onPress={() => setFocusedField('number')}
            >
              <Text style={[styles.inputText, !number && { color: '#999' }]}>
                {number || `|Number (${maxNumberLength})`}
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.inputField,
                  { flex: 1, marginRight: 5, borderColor: focusedField === 'start' ? COLORS.primary : '#CCC', borderWidth: focusedField === 'start' ? 2 : 1 }
                ]}
                onPress={() => setFocusedField('start')}
              >
                <Text style={[styles.inputText, !startNumber && { color: '#999' }]}>
                  {startNumber || 'Start'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.inputField,
                  { flex: 1, marginRight: 5, borderColor: focusedField === 'end' ? COLORS.primary : '#CCC', borderWidth: focusedField === 'end' ? 2 : 1 }
                ]}
                onPress={() => setFocusedField('end')}
              >
                <Text style={[styles.inputText, !endNumber && { color: '#999' }]}>
                  {endNumber || 'End'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={[
              styles.inputField,
              { flex: 1, borderColor: focusedField === 'count' ? COLORS.primary : '#CCC', borderWidth: focusedField === 'count' ? 2 : 1 }
            ]}
            onPress={() => setFocusedField('count')}
          >
            <Text style={[styles.inputText, !count && { color: '#999' }]}>
              {count || 'Count'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionRow}>
          <ActionButton label={`D-${btnLabels.A}-1`} color={COLORS.btnGreen} onPress={() => handleAddTicket(btnLabels.A)} />
          <ActionButton label={`D-${btnLabels.B}-1`} color={COLORS.btnPink} onPress={() => handleAddTicket(btnLabels.B)} />
          {btnLabels.C && <ActionButton label={`D-${btnLabels.C}-1`} color={COLORS.btnOrange} onPress={() => handleAddTicket(btnLabels.C)} />}
          <ActionButton label={btnLabels.All} color={COLORS.btnRed} onPress={() => handleAddTicket('ALL')} />
        </View>
      </View>

      <View style={styles.listContainer}>
        <FlatList
          data={tickets}
          renderItem={renderTicketItem}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 10 }}
        />
      </View>

      <CustomKeypad
        onKeyPress={handleKeyPress}
        onSave={handleSave}
        onClear={handleClear}
        onWhatsapp={() => alert('Open Whatsapp')}
      />
    </SafeAreaView>
  );
}

const Checkbox = ({ label, checked, onPress }) => (
  <TouchableOpacity onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 15 }}>
    <View style={{
      width: 20, height: 20, borderWidth: 1, borderColor: '#666', marginRight: 5,
      backgroundColor: checked ? COLORS.primary : 'transparent',
      justifyContent: 'center', alignItems: 'center'
    }}>
      {checked && <Ionicons name="checkmark" size={14} color="#FFF" />}
    </View>
    <Text style={{ fontWeight: 'bold' }}>{label}</Text>
  </TouchableOpacity>
);

const ActionButton = ({ label, color, onPress }) => (
  <TouchableOpacity
    style={[styles.actionBtn, { backgroundColor: color }]}
    onPress={onPress}
  >
    <Text style={styles.actionBtnText}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: COLORS.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: '#DDD',
  },
  statLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  tabsContainer: {
    flexDirection: 'row',
  },
  tab: {
    paddingVertical: 5,
    paddingHorizontal: 15,
    backgroundColor: '#FFF',
    marginLeft: 5,
    borderRadius: 2,
  },
  activeTab: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  activeTabText: {
    color: '#FFF',
  },
  formContainer: {
    padding: 10,
    backgroundColor: COLORS.headerBg,
  },
  inputWrapper: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 4,
    padding: 10,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputText: {
    fontSize: 16,
    color: '#333',
  },
  checkboxRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  inputsRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  inputField: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 4,
    padding: 10,
    fontSize: 16,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    marginHorizontal: 2,
    alignItems: 'center',
    borderRadius: 2,
  },
  actionBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  listContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 5,
  },
  ticketRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    alignItems: 'center',
  },
  ticketText: {
    fontSize: 16,
    fontWeight: 'bold',
  }
});
