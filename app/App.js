
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  StatusBar,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CustomKeypad from './components/CustomKeypad';
import { COLORS } from './constants/theme';
import { ticketService } from './services/ticketService'; // Using the real service now

export default function App() {
  const [tickets, setTickets] = useState([]);
  const [currentTab, setCurrentTab] = useState(3); // Default Tab 3
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null); // Stores full object
  const [agent, setAgent] = useState(null); // Full User Object
  const [agentInput, setAgentInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  // User Management State
  const [currentView, setCurrentView] = useState('game'); // 'game' or 'users'
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [newBalance, setNewBalance] = useState('');

  // Results State
  const [resultInput, setResultInput] = useState('');

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
    c100: false, // 100 logic
    c111: false
  });

  // Load Games (Real)
  React.useEffect(() => {
    loadGames();
  }, []);

  const loadGames = async () => {
    const { data } = await ticketService.getActiveGames();
    if (data && data.length > 0) {
      setGames(data);
      setSelectedGame(data[0]);
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

    // Handle Backspace / Delete
    if (key === 'X') {
      if (focusedField === 'number') {
        setNumber(prev => prev.slice(0, -1));
      }
      if (focusedField === 'start') {
        if (startNumber.length === 0) return;
        setStartNumber(prev => prev.slice(0, -1));
      }
      if (focusedField === 'end') {
        if (endNumber.length === 0) {
          setFocusedField('start'); // Jump back
          return;
        }
        setEndNumber(prev => prev.slice(0, -1));
      }
      if (focusedField === 'count') {
        if (count.length === 0) {
          // Jump back depending on mode
          if (checks.any || checks.c100) setFocusedField('end');
          else setFocusedField('number');
          return;
        }
        setCount(prev => prev.slice(0, -1));
      }
      return;
    }

    // Normal Input
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
    // User requested "clear should clear only list"
    setTickets([]);
  };

  const handleTabChange = (tab) => {
    setCurrentTab(tab);
    setNumber(''); updateChecks('none');
    setCount('');
    setFocusedField('number');
  };

  const updateChecks = (type) => {
    if (type === 'none') {
      setChecks({ any: false, set: false, c100: false, c111: false });
      // Optional: clear inputs when unchecking all
      setNumber(''); setStartNumber(''); setEndNumber('');
      setFocusedField('number');
      return;
    }

    setChecks(prev => {
      const newState = { any: false, set: false, c100: false, c111: false }; // Clear others
      newState[type] = !prev[type]; // Toggle current

      if (!newState[type]) {
        setFocusedField('number');
      } else {
        // If toggling ON
        if (type === 'any' || type === 'c100' || type === 'c111') {
          setFocusedField('start');
          setNumber(''); setStartNumber(''); setEndNumber('');
        } else {
          setFocusedField('number');
          setNumber('');
        }
      }
      return newState;
    });
  };

  // Permutation Helper
  const getPermutations = (str) => {
    if (str.length <= 1) return [str];
    const allPerms = getPermutations(str.slice(1));
    const firstChar = str[0];
    const newPerms = [];
    allPerms.forEach(perm => {
      for (let i = 0; i <= perm.length; i++) {
        newPerms.push(perm.substring(0, i) + firstChar + perm.substring(i));
      }
    });
    return [...new Set(newPerms)]; // Unique permutations only
  };

  const handleAddTicket = (typeLabel) => {
    const { any: isAny, set: isSet, c100: is100, c111: is111 } = checks;

    // Validation
    if (isAny || is100 || is111) {
      if (!startNumber || !endNumber || !count) return;
    } else {
      if (!number || !count) return;
    }

    let ticketsToCreate = [];
    let numbersToProcess = [];

    // 1. Determine Numbers List
    if (isAny) {
      let loopStart = parseInt(startNumber);
      let loopEnd = parseInt(endNumber);
      if (isNaN(loopStart) || isNaN(loopEnd) || loopStart > loopEnd) {
        alert('Invalid Range'); return;
      }
      for (let i = loopStart; i <= loopEnd; i++) {
        numbersToProcess.push(i.toString().padStart(maxNumberLength, '0'));
      }
    } else if (is100) {
      let loopStart = parseInt(startNumber);
      let loopEnd = parseInt(endNumber);
      if (isNaN(loopStart) || isNaN(loopEnd) || loopStart > loopEnd) {
        alert('Invalid Range'); return;
      }
      for (let i = loopStart; i <= loopEnd; i++) {
        // 100 logic: i + "00"
        numbersToProcess.push(i.toString() + "00");
      }
    } else if (is111) {
      // 111 Logic: Range based on the First Digit of the input
      // If Start="000" (0) and End="333" (3) -> Loop 0 to 3 -> Generate 000, 111, 222, 333
      let startDigit = parseInt(startNumber.charAt(0));
      let endDigit = parseInt(endNumber.charAt(0));

      if (isNaN(startDigit) || isNaN(endDigit) || startDigit > endDigit) {
        alert('Invalid Range. Use e.g., 000 to 333'); return;
      }
      for (let i = startDigit; i <= endDigit; i++) {
        numbersToProcess.push(i.toString().repeat(maxNumberLength));
      }
    } else if (isSet) {
      numbersToProcess = getPermutations(number);
    } else {
      numbersToProcess = [number];
    }

    // 2. Determine Types
    let typesToAdd = [];
    if (typeLabel === 'ALL') {
      if (currentTab === 1) typesToAdd = [btnLabels.A, btnLabels.B, btnLabels.C];
      if (currentTab === 2) typesToAdd = [btnLabels.A, btnLabels.B, btnLabels.C];
      if (currentTab === 3) typesToAdd = [btnLabels.A, btnLabels.B];
    } else {
      typesToAdd = [typeLabel];
    }

    // 3. Generate Tickets
    numbersToProcess.forEach(numStr => {
      typesToAdd.forEach(type => {
        // Fix: Use selectedGame.name instead of selectedGame string
        const gameName = selectedGame ? selectedGame.name : 'GAME';

        ticketsToCreate.push({
          id: Date.now().toString() + Math.random(),
          name: gameName.replace('D-', '').split(':')[0] + ' ' + type,
          number: numStr,
          count: count,
          total: parseInt(count) * 10,
          boxType: type,
          color: getTypeColor(type)
        });
      });
    });

    setTickets([...ticketsToCreate, ...tickets]);
    // Reset Inputs after add
    setNumber(''); setStartNumber(''); setEndNumber(''); setCount('');
    if (isAny || is100) setFocusedField('start');
    else setFocusedField('number');
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
    if (!selectedGame || !selectedGame.id) {
      alert('No game selected!');
      return;
    }

    // Real Save
    // Pass tickets, gameId, and userId
    const { error } = await ticketService.buyTicket(tickets, selectedGame.id, agent.id);

    if (error) {
      alert('Error saving: ' + (error.message || JSON.stringify(error)));
    } else {
      alert('Saved Successfully!');
      setTickets([]);
    }
  };

  const handleDeleteTicket = (id) => {
    setTickets(prevTickets => prevTickets.filter(t => t.id !== id));
  };

  const renderTicketItem = ({ item }) => (
    <View style={styles.ticketRow}>
      <Text style={[styles.ticketText, { color: item.color, flex: 2 }]}>{item.name}</Text>
      <Text style={[styles.ticketText, { color: item.color, flex: 1 }]}>{item.number}</Text>
      <Text style={[styles.ticketText, { color: item.color, flex: 1 }]}>{item.count}</Text>
      <Text style={[styles.ticketText, { color: item.color, flex: 1 }]}>{item.total}</Text>
      <TouchableOpacity onPress={() => handleDeleteTicket(item.id)}>
        <Ionicons name="trash-outline" size={20} color="#666" />
      </TouchableOpacity>
    </View>
  );

  const handleLogin = async () => {
    if (agentInput.trim().length === 0 || passwordInput.trim().length === 0) {
      alert('Please enter username and password');
      return;
    }

    const { data, error } = await ticketService.login(agentInput.trim(), passwordInput.trim());

    if (error) {
      alert('Login Failed: ' + error);
    } else {
      setAgent(data); // Store full user object
    }
  };

  if (!agent) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', padding: 20 }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />
        <View style={{ backgroundColor: '#FFF', padding: 20, borderRadius: 10, elevation: 3 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: COLORS.primary }}>
            Agent Login
          </Text>
          <Text style={{ marginBottom: 10, color: '#666' }}>Username:</Text>
          <TextInput
            style={{
              borderWidth: 1, borderColor: '#DDD', backgroundColor: '#F9F9F9',
              padding: 15, borderRadius: 8, fontSize: 16, marginBottom: 15
            }}
            value={agentInput}
            onChangeText={setAgentInput}
            placeholder="e.g. admin"
            autoCapitalize="none"
          />

          <Text style={{ marginBottom: 10, color: '#666' }}>Password:</Text>
          <TextInput
            style={{
              borderWidth: 1, borderColor: '#DDD', backgroundColor: '#F9F9F9',
              padding: 15, borderRadius: 8, fontSize: 16, marginBottom: 20
            }}
            value={passwordInput}
            onChangeText={setPasswordInput}
            placeholder="Enter Password"
            secureTextEntry
          />

          <TouchableOpacity
            onPress={handleLogin}
            style={{
              backgroundColor: COLORS.primary, padding: 15, borderRadius: 8, alignItems: 'center'
            }}
          >
            <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>LOGIN</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />

      <View style={styles.header}>
        <View>
          <Text style={styles.statLabel}>COUNT : {totalCount}</Text>
          <Text style={styles.statLabel}>Rs : {totalRs}</Text>
        </View>

        {/* User Management Button */}
        {/* User Management & Results Button (Admin Only) */}
        {agent && agent.role === 'admin' && ( // Only Admin can declare results
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity
              style={{ backgroundColor: COLORS.primary, padding: 8, borderRadius: 5, marginRight: 5 }}
              onPress={() => setCurrentView(currentView === 'users' ? 'game' : 'users')}
            >
              <Text style={{ color: '#FFF', fontWeight: 'bold' }}>
                {currentView === 'users' ? 'GAME' : 'USERS'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: COLORS.btnOrange, padding: 8, borderRadius: 5, marginRight: 10 }}
              onPress={() => setCurrentView(currentView === 'results' ? 'game' : 'results')}
            >
              <Text style={{ color: '#FFF', fontWeight: 'bold' }}>
                {currentView === 'results' ? 'GAME' : 'RESULT'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {agent && agent.role !== 'admin' && agent.role !== 'user' && ( // Agents can create sub-users
          <TouchableOpacity
            style={{ backgroundColor: COLORS.primary, padding: 8, borderRadius: 5, marginRight: 10 }}
            onPress={() => setCurrentView(currentView === 'users' ? 'game' : 'users')}
          >
            <Text style={{ color: '#FFF', fontWeight: 'bold' }}>
              {currentView === 'users' ? 'GAME' : 'USERS'}
            </Text>
          </TouchableOpacity>
        )}

        {currentView === 'game' && (
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
        )}
      </View>

      {/* VIEW: USER MANAGEMENT */}
      {currentView === 'users' ? (
        <View style={styles.formContainer}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: COLORS.primary }}>
            Create Sub-User
          </Text>

          <Text style={{ marginBottom: 5 }}>New Username:</Text>
          <TextInput
            style={styles.inputField}
            value={newUsername} onChangeText={setNewUsername}
            placeholder="Username" autoCapitalize="none"
          />

          <Text style={{ marginBottom: 5, marginTop: 10 }}>New Password:</Text>
          <TextInput
            style={styles.inputField}
            value={newPassword} onChangeText={setNewPassword}
            placeholder="Password"
          />

          <Text style={{ marginBottom: 5, marginTop: 10 }}>Initial Balance:</Text>
          <TextInput
            style={styles.inputField}
            value={newBalance} onChangeText={setNewBalance}
            placeholder="0.00" keyboardType="numeric"
          />

          <TouchableOpacity
            style={{
              backgroundColor: COLORS.btnGreen, padding: 15, borderRadius: 5,
              marginTop: 20, alignItems: 'center'
            }}
            onPress={async () => {
              if (!newUsername || !newPassword) { alert('Fill all fields'); return; }

              const { data, error } = await ticketService.createUser(
                agent, newUsername.trim(), newPassword.trim(), newBalance
              );

              if (error) alert('Error: ' + error);
              else {
                alert(`Success! Created User: ${data.username} (${data.role})`);
                setNewUsername(''); setNewPassword(''); setNewBalance('');
              }
            }}
          >
            <Text style={{ color: '#FFF', fontWeight: 'bold' }}>CREATE USER</Text>
          </TouchableOpacity>
        </View>
      ) : currentView === 'results' ? (
        /* VIEW: DECLARE RESULTS (ADMIN) */
        <View style={styles.formContainer}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: COLORS.btnOrange }}>
            Declare Daily Result
          </Text>

          <Text style={{ marginBottom: 10 }}>Select Game:</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputText}>{selectedGame ? selectedGame.name : 'Loading...'}</Text>
          </View>

          <Text style={{ marginBottom: 10, marginTop: 10 }}>Winning Number (3 Digits):</Text>
          <TextInput
            style={[styles.inputField, { fontSize: 24, textAlign: 'center', letterSpacing: 5 }]}
            value={resultInput} onChangeText={setResultInput}
            placeholder="---" maxLength={3} keyboardType="numeric"
          />

          <TouchableOpacity
            style={{
              backgroundColor: COLORS.btnRed, padding: 15, borderRadius: 5,
              marginTop: 30, alignItems: 'center'
            }}
            onPress={async () => {
              if (resultInput.length !== 3) { alert('Enter 3 digits'); return; }

              const { data, error } = await ticketService.declareResult(selectedGame.id, resultInput);

              if (error) alert('Error: ' + error);
              else {
                alert(`Result Declared: ${resultInput}\nWinnings Calculated!`);
                setResultInput('');
              }
            }}
          >
            <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 18 }}>DECLARE & CALCULATE</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* VIEW: GAME FORM */
        <View style={styles.formContainer}>
          {/* Game/Agent Dropdowns */}
          <View style={styles.inputWrapper}>
            <Text style={styles.inputText}>{selectedGame ? selectedGame.name : 'Loading...'}</Text>
            <Ionicons name="caret-down" size={16} color="#666" />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputText}>{agent ? agent.username : ''}</Text>
            <Ionicons name="caret-down" size={16} color="#666" />
          </View>

          {/* Checkboxes */}
          <View style={styles.checkboxRow}>
            <Checkbox label="Any" checked={checks.any} onPress={() => updateChecks('any')} />
            <Checkbox label="Set" checked={checks.set} onPress={() => updateChecks('set')} />
            <Checkbox label="100" checked={checks.c100} onPress={() => updateChecks('c100')} />
            <Checkbox label="111" checked={checks.c111} onPress={() => updateChecks('c111')} />
          </View>

          {/* Inputs */}
          <View style={styles.inputsRow}>
            {(!checks.any && !checks.c100 && !checks.c111) ? (
              <TouchableOpacity
                style={[styles.inputField, { flex: 1, marginRight: 5, borderColor: focusedField === 'number' ? COLORS.primary : '#CCC', borderWidth: focusedField === 'number' ? 2 : 1 }]}
                onPress={() => setFocusedField('number')}
              >
                <Text style={[styles.inputText, !number && { color: '#999' }]}>
                  {number || `|Number (${maxNumberLength})`}
                </Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.inputField, { flex: 1, marginRight: 5, borderColor: focusedField === 'start' ? COLORS.primary : '#CCC', borderWidth: focusedField === 'start' ? 2 : 1 }]}
                  onPress={() => setFocusedField('start')}
                >
                  <Text style={[styles.inputText, !startNumber && { color: '#999' }]}>{startNumber || 'Start'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.inputField, { flex: 1, marginRight: 5, borderColor: focusedField === 'end' ? COLORS.primary : '#CCC', borderWidth: focusedField === 'end' ? 2 : 1 }]}
                  onPress={() => setFocusedField('end')}
                >
                  <Text style={[styles.inputText, !endNumber && { color: '#999' }]}>{endNumber || 'End'}</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={[styles.inputField, { flex: 1, borderColor: focusedField === 'count' ? COLORS.primary : '#CCC', borderWidth: focusedField === 'count' ? 2 : 1 }]}
              onPress={() => setFocusedField('count')}
            >
              <Text style={[styles.inputText, !count && { color: '#999' }]}>{count || 'Count'}</Text>
            </TouchableOpacity>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <ActionButton label={`D-${btnLabels.A}-1`} color={COLORS.btnGreen} onPress={() => handleAddTicket(btnLabels.A)} />
            <ActionButton label={`D-${btnLabels.B}-1`} color={COLORS.btnPink} onPress={() => handleAddTicket(btnLabels.B)} />
            {btnLabels.C && <ActionButton label={`D-${btnLabels.C}-1`} color={COLORS.btnOrange} onPress={() => handleAddTicket(btnLabels.C)} />}
            <ActionButton label={btnLabels.All} color={COLORS.btnRed} onPress={() => handleAddTicket('ALL')} />
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
        </View>
      )}
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
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 1,
    },
    elevation: 2,
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
    flex: 1,
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
