
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  StatusBar,
  TextInput,
  Animated,
  Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import CustomKeypad from './components/CustomKeypad';
import { COLORS } from './constants/theme';
import { ticketService } from './services/ticketService'; // Using the real service now

// Common styles for consistency
const commonInputStyle = {
  backgroundColor: COLORS.surface,
  color: COLORS.textPrimary,
  borderColor: COLORS.border,
  placeholderTextColor: COLORS.placeholder
};

export default function App() {
  const [tickets, setTickets] = useState([]);
  const [currentTab, setCurrentTab] = useState(3); // Default Tab 3
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null); // Stores full object
  const [agent, setAgent] = useState(null); // Full User Object

  // Custom Dropdown State for Agents
  const [subUsers, setSubUsers] = useState([]);
  const [selectedSubUser, setSelectedSubUser] = useState(null);
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);
  const [isGameDropdownOpen, setIsGameDropdownOpen] = useState(false);
  const [agentInput, setAgentInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  // User Management State
  const [currentView, setCurrentView] = useState('dashboard'); // Default to dashboard after login
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

  const [rates, setRates] = useState({}); // Store user rates
  const [assignedRates, setAssignedRates] = useState({}); // New rates for sub-user
  const [isMenuOpen, setIsMenuOpen] = useState(false); // Side Menu State
  const menuAnim = React.useRef(new Animated.Value(-300)).current; // Slide animation

  // Edit User State
  const [editingUser, setEditingUser] = useState(null);
  const [editLimits, setEditLimits] = useState({ daily: '', weekly: '', single: '' }); // Added weekly
  const [editIsActive, setEditIsActive] = useState(true);
  const [editBlockedNumbers, setEditBlockedNumbers] = useState(''); // Comma separated

  // Load Games (Real)

  React.useEffect(() => {
    loadGames();
    if (agent && agent.id) {
      loadSubUsers();
    }
  }, [agent]); // Reload subusers when agent changes

  const loadSubUsers = async () => {
    if (!agent) return;
    const { data } = await ticketService.getSubUsers(agent.id);
    if (data) {
      setSubUsers(data);
      // Default to self or first subuser? Usually self if allowed, but request says "login user gets his first underchild users".
      // Let's assume the dropdown includes SELF + Children or just Children? 
      // "each login user gets his first underchild users in dropdown"
      // Let's populate the list with [Self, ...Children]
      const allUsers = [agent, ...data];
      setSubUsers(allUsers);
      setSelectedSubUser(agent); // Default to self
    }
  };

  const loadRates = async () => {
    if (!agent) return;

    // 1. Get My Rates (Cost)
    const { data } = await ticketService.getUserRates(agent.id);
    if (data) setRates(data);

    // 2. Get Sub-Users for Dropdown
    const { data: subs } = await ticketService.getSubUsers(agent.id);
    setSubUsers(subs); // Use fetched subs
    if (subs.length > 0) setSelectedSubUser(null); // Reset selection
  };

  const handleSaveRates = async () => {
    if (!selectedSubUser) { alert('Please select a customer first'); return; }

    // Merge existing rates with updates, or just send updates? Service handles upsert.
    // Validate? (Assigned > My Rate) - Optional but good.

    const { error } = await ticketService.updateUserRates(selectedSubUser.id, assignedRates);
    if (error) alert('Error saving rates: ' + error);
    else {
      alert('Rates updated successfully for ' + selectedSubUser.username);
      setAssignedRates({}); // Clear
    }
  };

  const loadGames = async () => {
    const { data } = await ticketService.getActiveGames();
    if (data && data.length > 0) {
      // Pre-calculate display properties
      const processedGames = data.map(g => {
        const timeStr = new Date(g.draw_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        let displayName = g.name;
        let color = '#2196F3'; // Default

        // Logic to match Screenshot: D-1:00PM, K-3:00PM, etc.
        if (timeStr.includes('1:00') || timeStr.includes('01:00')) {
          displayName = 'D-1:00PM'; color = '#2962FF'; // Blue
        } else if (timeStr.includes('3:00') || timeStr.includes('03:00')) {
          displayName = 'K-3:00PM'; color = '#2E7D32'; // Green (K for 3pm)
        } else if (timeStr.includes('6:00') || timeStr.includes('06:00')) {
          displayName = 'D-6:00PM'; color = '#E91E63'; // Pink
        } else if (timeStr.includes('8:00') || timeStr.includes('08:00')) {
          displayName = 'D-8:00PM'; color = '#EF6C00'; // Orange
        }
        return { ...g, displayName, color };
      });

      setGames(processedGames);
      setSelectedGame(processedGames[0]);
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
    if (key === 'NEXT') return; // Next logic if any?

    // Handle 'SAVE' key from Keypad -> Triggers Add Ticket
    if (key === 'SAVE') {
      // Default to 'A' or currently selected mode? 
      // The keypad 'Save' likely means "Add to List" or "Buy"?
      // Screenshot has separate "Add" button usually? No, screenshot shows "Save" on keypad.
      // It likely submits the current number input as a ticket.
      // We'll assume it defaults to 'ALL' to be safe or maybe just triggers the primary action.
      handleAddTicket('ALL');
      return;
    }

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

  const toggleMenu = () => {
    const toValue = isMenuOpen ? -300 : 0;
    setIsMenuOpen(!isMenuOpen);
    Animated.timing(menuAnim, {
      toValue,
      duration: 300,
      useNativeDriver: false, // width/left layout changes
    }).start();
  };

  const navigateTo = (view) => {
    setCurrentView(view);
    if (view === 'rates') loadRates();
    toggleMenu(); // Close menu
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
    // Pass tickets, gameId, and userId (Use selectedSubUser if set, else agent)
    const targetUserId = selectedSubUser ? selectedSubUser.id : agent.id;
    const { error } = await ticketService.buyTicket(tickets, selectedGame.id, targetUserId);

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
      setCurrentView('dashboard'); // Go to Dashboard on login
    }
  };

  if (!agent) {
    return (

      <View style={{ flex: 1, backgroundColor: '#FFF' }}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />

        {/* Header Wave Background (Simulated with View) */}
        <View style={{ height: '25%', width: '100%', backgroundColor: COLORS.btnLoginGreen, borderBottomLeftRadius: 50, borderBottomRightRadius: 50, position: 'absolute', top: 0 }}>
          <View style={{ height: '100%', width: '100%', backgroundColor: 'rgba(255,255,255,0.2)', borderBottomLeftRadius: 50, borderBottomRightRadius: 50 }} />
        </View>

        <SafeAreaView style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 30 }}>
          <View style={{ marginTop: 100 }}>
            <Text style={{ fontSize: 18, color: '#333', marginBottom: 5 }}>Welcome !</Text>
            <Text style={{ fontSize: 36, fontWeight: 'bold', color: '#000', marginBottom: 40 }}>Login</Text>

            <View style={{ marginBottom: 20 }}>
              <TextInput
                style={{
                  borderWidth: 1, borderColor: '#E0E0E0', backgroundColor: '#FFF',
                  padding: 15, borderRadius: 30, fontSize: 16, color: '#000'
                }}
                value={agentInput}
                onChangeText={setAgentInput}
                placeholder="Username"
                placeholderTextColor="#999"
                autoCapitalize="none"
              />
            </View>

            <View style={{ marginBottom: 20, position: 'relative' }}>
              <TextInput
                style={{
                  borderWidth: 1, borderColor: '#E0E0E0', backgroundColor: '#FFF',
                  padding: 15, borderRadius: 30, fontSize: 16, color: '#000'
                }}
                value={passwordInput}
                onChangeText={setPasswordInput}
                placeholder="password"
                placeholderTextColor="#999"
                secureTextEntry
              />
              <Ionicons name="eye" size={20} color="#999" style={{ position: 'absolute', right: 20, top: 18 }} />
            </View>

            {/* Social Login Placeholders */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 30, gap: 20 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF', elevation: 2, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: 'red', fontWeight: 'bold', fontSize: 20 }}>G</Text>
              </View>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF', elevation: 2, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: 'blue', fontWeight: 'bold', fontSize: 20 }}>f</Text>
              </View>

              {/* Login Button next to Socials as per screenshot? No, typically simpler layout. Screenshot has separate row. 
                     Let's match screenshot: Socials on left? No, screenshot is weird. 
                     Actually screenshot has Socials on LEFT, Login Button on RIGHT of the same row? 
                     Or Socials centered above? 
                     Looking at screenshot again: it has Inputs, then a row with [G] [f] [ Login > ] 
                 */}
              <TouchableOpacity
                onPress={handleLogin}
                style={{
                  backgroundColor: COLORS.btnLoginGreen,
                  paddingVertical: 12, paddingHorizontal: 40,
                  borderRadius: 30, alignItems: 'center', flexDirection: 'row',
                  flex: 1, marginLeft: 20, justifyContent: 'center'
                }}
              >
                <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 18, marginRight: 10 }}>Login</Text>
                <Ionicons name="chevron-forward" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>


            <View style={{ alignItems: 'center', marginTop: 20 }}>
              <TouchableOpacity><Text style={{ color: COLORS.secondary, marginBottom: 20 }}>Forgot Password</Text></TouchableOpacity>
              <View style={{ flexDirection: 'row' }}>
                <Text style={{ color: '#666' }}>Don't have an account? </Text>
                <TouchableOpacity><Text style={{ color: COLORS.secondary, fontWeight: 'bold' }}>Create Account</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const renderDashboard = () => (
    <View style={styles.formContainer}>
      <View style={{ gap: 15, padding: 10 }}>
        <TouchableOpacity
          style={styles.dashboardBtnBlue}
          onPress={() => setCurrentView('game')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="add-outline" size={28} color="#FFF" style={{ marginRight: 15 }} />
            <Text style={styles.dashboardBtnText}>Add</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dashboardBtnLightBlue}
          onPress={() => setCurrentView('reports')} // Placeholder for now
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="document-text-outline" size={28} color="#FFF" style={{ marginRight: 15 }} />
            <Text style={styles.dashboardBtnText}>Reports</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dashboardBtnSkyBlue}
          onPress={() => setCurrentView('users')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="grid-outline" size={28} color="#FFF" style={{ marginRight: 15 }} />
            <Text style={styles.dashboardBtnText}>Manage</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderUserDetail = () => {
    if (!editingUser) return null;

    const handleSaveUser = async () => {
      // Save Limits
      if (editLimits.daily || editLimits.single || editLimits.weekly || editBlockedNumbers) {
        const limits = {};
        if (editLimits.daily) limits.daily_sales_limit = parseFloat(editLimits.daily);
        if (editLimits.weekly) limits.weekly_sales_limit = parseFloat(editLimits.weekly);
        if (editLimits.single) limits.max_single_number_count = parseInt(editLimits.single);
        if (editBlockedNumbers) limits.blocked_numbers = editBlockedNumbers; // Send as string

        const { error } = await ticketService.updateUserLimits(editingUser.id, limits);
        if (error) { alert('Error saving limits: ' + error); return; }
      }

      // Save Status
      if (editIsActive !== editingUser.is_active) {
        const { error } = await ticketService.toggleUserStatus(editingUser.id, editIsActive);
        if (error) { alert('Error updating status: ' + error); return; }
      }

      alert('User updated successfully!');
      setEditingUser(null);
      loadSubUsers(); // Refresh list
    };

    return (
      <View style={{ flex: 1, padding: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <TouchableOpacity onPress={() => setEditingUser(null)}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={{ fontSize: 24, fontWeight: 'bold', marginLeft: 10, color: '#333' }}>Edit Customer</Text>
        </View>

        <View style={{ backgroundColor: '#FFF', padding: 15, borderRadius: 8, elevation: 2 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 15 }}>{editingUser.username}</Text>

          {/* Status Toggle */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 16 }}>Block User</Text>
            <Switch
              value={!editIsActive}
              onValueChange={(val) => setEditIsActive(!val)}
              trackColor={{ false: "#767577", true: "red" }}
            />
          </View>

          <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>Sales Limits</Text>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputText}>Daily Sales Limit</Text>
            <TextInput
              style={{ minWidth: 100, textAlign: 'right', fontSize: 16 }}
              placeholder="No Limit"
              value={editLimits.daily}
              onChangeText={t => setEditLimits({ ...editLimits, daily: t })}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputText}>Weekly Sales Limit</Text>
            <TextInput
              style={{ minWidth: 100, textAlign: 'right', fontSize: 16 }}
              placeholder="No Limit"
              value={editLimits.weekly}
              onChangeText={t => setEditLimits({ ...editLimits, weekly: t })}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputText}>Max Per Number</Text>
            <TextInput
              style={{ minWidth: 100, textAlign: 'right', fontSize: 16 }}
              placeholder="No Limit"
              value={editLimits.single}
              onChangeText={t => setEditLimits({ ...editLimits, single: t })}
              keyboardType="numeric"
            />
          </View>

          <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10, marginTop: 10 }}>Block Numbers</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={{ flex: 1, fontSize: 16 }}
              placeholder="Ex: 123, 44, 9"
              value={editBlockedNumbers}
              onChangeText={setEditBlockedNumbers}
            />
          </View>

          <TouchableOpacity
            style={{ backgroundColor: COLORS.primary, padding: 15, borderRadius: 5, alignItems: 'center', marginTop: 20 }}
            onPress={handleSaveUser}
          >
            <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderUsers = () => {
    if (editingUser) return renderUserDetail();

    return (
      <View style={{ flex: 1, padding: 20 }}>
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
              loadSubUsers();
            }
          }}
        >
          <Text style={{ color: '#FFF', fontWeight: 'bold' }}>CREATE USER</Text>
        </TouchableOpacity>

        {/* Existing Users List */}
        <View style={{ marginTop: 30 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#333' }}>Existing Customers</Text>
          {subUsers && subUsers.length > 0 ? subUsers.map((user, i) => (
            <View key={user.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: user.is_active ? '#333' : 'red' }}>{user.username}</Text>
                <Text style={{ color: '#666' }}>Role: {user.role}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontWeight: 'bold', color: COLORS.primary, marginRight: 15 }}>₹{user.balance}</Text>
                <TouchableOpacity onPress={() => {
                  setEditingUser(user);
                  setEditIsActive(user.is_active);
                  setEditLimits({ daily: '', weekly: '', single: '' });
                  setEditBlockedNumbers('');
                  // Ideally fetch limits here. Assuming for now we rely on user inputting new values or we fetch in useEffect when editingUser changes.
                }}>
                  <Ionicons name="create-outline" size={24} color="#555" />
                </TouchableOpacity>
              </View>
            </View>
          )) : <Text>No customers found.</Text>}
        </View>

        <View style={{ marginTop: 20, borderTopWidth: 1, borderTopColor: '#CCC', paddingTop: 20 }}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: COLORS.secondary }]}
            onPress={() => { setCurrentView('rates'); loadRates(); }}
          >
            <Text style={[styles.actionButtonText, { textAlign: 'center' }]}>My Rates (Rate Master)</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderRates = () => {
    // 1. Prepare Data for Table
    const rateTypes = [
      { label: 'Single(1)', key: 'single' },
      { label: 'Double(2)', key: 'double' },
      { label: 'Triple', key: 'triple' },
      { label: 'Quad', key: 'quad' },
    ];

    return (
      <View style={{ flex: 1, padding: 20 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <TouchableOpacity onPress={() => setCurrentView('users')}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={{ fontSize: 24, fontWeight: 'bold', marginLeft: 10, color: '#333' }}>Rate Master</Text>
        </View>

        {/* Dropdowns */}
        <View style={{ marginBottom: 20, zIndex: 2000 }}>
          {/* Game Dropdown (Visual only for now as rates are global) */}
          <View style={{ marginBottom: 15 }}>
            <TouchableOpacity
              style={{ borderBottomWidth: 2, borderBottomColor: COLORS.primary, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between' }}
            >
              <Text style={{ fontSize: 16, color: '#333' }}>{games.length > 0 ? '1:00PM' : 'Loading...'}</Text>
              <Ionicons name="caret-down" size={16} color="#666" />
            </TouchableOpacity>
          </View>

          {/* User Selection Dropdown */}
          <View>
            <TouchableOpacity
              style={{ borderBottomWidth: 1, borderBottomColor: '#CCC', paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between' }}
              onPress={() => setIsAgentDropdownOpen(!isAgentDropdownOpen)}
            >
              <Text style={{ fontSize: 16, color: '#333' }}>
                {selectedSubUser ? selectedSubUser.username : 'Select Customer'}
              </Text>
              <Ionicons name="caret-down" size={16} color="#666" />
            </TouchableOpacity>

            {isAgentDropdownOpen && (
              <View style={{
                position: 'absolute', top: '100%', left: 0, right: 0,
                backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CCC',
                elevation: 5, maxHeight: 200
              }}>
                <FlatList
                  data={subUsers}
                  keyExtractor={item => item.id.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={{ padding: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' }}
                      onPress={async () => {
                        setSelectedSubUser(item);
                        setIsAgentDropdownOpen(false);
                        // Fetch Sub User Rates to populate "Assign Rate"
                        const { data: subRates } = await ticketService.getUserRates(item.id);
                        if (subRates) setAssignedRates(subRates); // Pre-fill with existing
                        else setAssignedRates({});
                      }}
                    >
                      <Text>{item.username}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}
          </View>
        </View>

        {/* Table Title */}
        <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 10, color: '#333' }}>Ticket Price details</Text>

        {/* Table */}
        <View style={{ backgroundColor: '#FFF', elevation: 1 }}>
          <View style={{ flexDirection: 'row', backgroundColor: '#9E9E9E', padding: 10 }}>
            <Text style={{ flex: 1.5, color: '#FFF', fontWeight: 'bold' }}>Ticket</Text>
            <Text style={{ flex: 1, color: '#FFF', fontWeight: 'bold' }}>Rate</Text>
            <Text style={{ flex: 1, color: '#FFF', fontWeight: 'bold' }}>Assign Rate</Text>
          </View>

          {rateTypes.map((item, index) => {
            const myRate = rates[item.key] || 0.0;
            const assignedVal = assignedRates[item.key] !== undefined ? assignedRates[item.key].toString() : '';

            return (
              <View key={index} style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EEE', paddingVertical: 10, paddingHorizontal: 5, alignItems: 'center' }}>
                <Text style={{ flex: 1.5, fontSize: 16, fontWeight: 'bold', color: '#000' }}>{item.label}</Text>

                {/* My Rate (Read Only) */}
                <Text style={{ flex: 1, fontSize: 16, color: '#333' }}>{myRate}</Text>

                {/* Assign Rate (Input) */}
                <TextInput
                  style={{
                    flex: 1, borderWidth: 1, borderColor: '#CCC',
                    padding: 5, color: '#000', fontSize: 16, borderRadius: 4,
                    backgroundColor: '#F9F9F9'
                  }}
                  keyboardType="numeric"
                  value={assignedVal}
                  placeholder={myRate.toString()} // Hint at current rate
                  onChangeText={(text) => {
                    setAssignedRates(prev => ({ ...prev, [item.key]: text }));
                  }}
                />
              </View>
            );
          })}
        </View>

        {/* Checkbox */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20 }}>
          <Checkbox
            label="Apply All Games"
            checked={true} // For now always true as we only have global rates
            onPress={() => { }}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={{
            backgroundColor: '#2962FF', padding: 15, alignItems: 'center',
            justifyContent: 'center', marginTop: 'auto', marginBottom: 20
          }}
          onPress={handleSaveRates}
        >
          <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 18 }}>Save</Text>
        </TouchableOpacity>

      </View>
    );
  };

  const renderPrizes = () => {
    const prizeData = [
      { name: 'First', rate: '5000', super: '400' },
      { name: 'Second', rate: '500', super: '50' },
      { name: 'Third', rate: '250', super: '30' },
      { name: 'Fourt', rate: '100', super: '20' },
      { name: 'Five', rate: '50', super: '20' },
      { name: 'Guarantee (Six)', rate: '20', super: '10' },
      { name: 'Box First Price', rate: '3000', super: '300' },
      { name: 'Box Series', rate: '800', super: '30' },
      { name: 'Single(1)', rate: '100', super: '0' },
      { name: 'Double(2)', rate: '700', super: '30' },
    ];

    return (
      <View style={{ flex: 1, padding: 20 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
          <TouchableOpacity onPress={() => setCurrentView('dashboard')}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: 'bold', marginLeft: 10, color: '#333' }}>Prize And Commission</Text>
        </View>

        {/* Table Header */}
        <View style={{ flexDirection: 'row', backgroundColor: '#9E9E9E', padding: 10 }}>
          <Text style={{ flex: 2, color: '#FFF', fontWeight: 'bold' }}>Prize</Text>
          <Text style={{ flex: 1, color: '#FFF', fontWeight: 'bold' }}>Rate</Text>
          <Text style={{ flex: 1, color: '#FFF', fontWeight: 'bold' }}>Super</Text>
        </View>

        <View style={{ flex: 1 }}>
          <FlatList
            data={prizeData}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item }) => (
              <View style={{ flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderBottomColor: '#EEE', backgroundColor: '#FFF' }}>
                <Text style={{ flex: 2, color: '#333', fontWeight: 'bold' }}>{item.name}</Text>
                <Text style={{ flex: 1, color: '#333' }}>{item.rate}</Text>
                <Text style={{ flex: 1, color: '#333' }}>{item.super}</Text>
              </View>
            )}
          />
        </View>
      </View>
    );
  };

  const renderSideMenu = () => (
    <Animated.View style={{
      position: 'absolute', top: 0, bottom: 0, left: menuAnim, width: 300,
      backgroundColor: '#FFF', zIndex: 5000, elevation: 20,
      paddingTop: 50
    }}>
      <View style={{ padding: 20, backgroundColor: COLORS.primary, marginBottom: 10 }}>
        <Text style={{ color: '#FFF', fontSize: 24, fontWeight: 'bold' }}>PVC</Text>
        <Text style={{ color: '#FFF', fontSize: 16 }}>{agent ? agent.username : 'Guest'}</Text>
      </View>

      <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('dashboard')}>
        <Ionicons name="home-outline" size={24} color="#333" />
        <Text style={styles.menuText}>Home</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('users')}>
        <Ionicons name="people-outline" size={24} color="#333" />
        <Text style={styles.menuText}>Customer</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('rates')}>
        <Ionicons name="pricetags-outline" size={24} color="#333" />
        <Text style={styles.menuText}>Rate Master</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('prizes')}>
        <Ionicons name="trophy-outline" size={24} color="#333" />
        <Text style={styles.menuText}>Prize And Commission</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('reports')}>
        <Ionicons name="document-text-outline" size={24} color="#333" />
        <Text style={styles.menuText}>Reports</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('results')}>
        <Ionicons name="podium-outline" size={24} color="#333" />
        <Text style={styles.menuText}>Results</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.menuItem, { marginTop: 20, borderTopWidth: 1, borderTopColor: '#EEE' }]} onPress={() => { setAgent(null); toggleMenu(); setCurrentView('login'); }}>
        <Ionicons name="log-out-outline" size={24} color="red" />
        <Text style={[styles.menuText, { color: 'red' }]}>Logout</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{ position: 'absolute', top: 10, right: 10 }}
        onPress={toggleMenu}
      >
        <Ionicons name="close" size={30} color="#FFF" />
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />





      {/* Main Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Always Show Menu Icon now? Or Back arrow for sub-views? 
              User requested Side Menu. Side Menu usually accessible from everywhere via Hamburger.
              Let's show Hamburger everywhere.
          */}
          <TouchableOpacity onPress={toggleMenu} style={{ marginRight: 15 }}>
            <Ionicons name="menu" size={28} color="#FFF" />
          </TouchableOpacity>

          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#FFF' }}>
            {currentView === 'dashboard' ? 'Home' :
              currentView === 'rates' ? 'Rate Master' :
                currentView === 'prizes' ? 'Prize & Comm' :
                  currentView === 'users' ? 'Customer' :
                    currentView === 'game' ? 'Ticket Sale' : 'PVC'}
          </Text>
        </View>
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#FFF' }}>{agent ? agent.username : ''}</Text>
      </View>

      {/* Content Area */}
      {currentView === 'dashboard' && renderDashboard()}
      {currentView === 'rates' && renderRates()}
      {currentView === 'prizes' && renderPrizes()}


      {currentView === 'game' && (
        <View style={{ flex: 1 }}>
          {/* Game Stats Header (Sub-header) */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 10, backgroundColor: '#E0E0E0', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', gap: 15 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 16 }}>COUNT :{totalCount}</Text>
              <Text style={{ fontWeight: 'bold', fontSize: 16 }}>Rs : {totalRs}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {[1, 2, 3].map(tab => (
                <TouchableOpacity
                  key={tab}
                  style={{
                    width: 30, height: 30, justifyContent: 'center', alignItems: 'center',
                    backgroundColor: currentTab === tab ? COLORS.primary : '#FFF',
                    borderRadius: 0
                  }}
                  onPress={() => handleTabChange(tab)}
                >
                  <Text style={{ fontWeight: 'bold', color: currentTab === tab ? '#FFF' : COLORS.primary }}>{tab}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formContainer}>
            {/* Game Form Content - Reused from before but wrapped */}

            {/* Game/Agent Dropdowns */}
            <View style={{ marginBottom: 10, zIndex: 1001 }}>
              <TouchableOpacity
                style={styles.inputWrapper}
                onPress={() => setIsGameDropdownOpen(!isGameDropdownOpen)}
              >
                <Text style={[styles.inputText, { fontSize: 18, fontWeight: 'bold' }]}>
                  {selectedGame ? (selectedGame.displayName || selectedGame.name) : '(Select Game)'}
                </Text>
                <Ionicons name={isGameDropdownOpen ? "caret-up" : "caret-down"} size={16} color="#666" />
              </TouchableOpacity>


              {isGameDropdownOpen && (
                <View style={{
                  position: 'absolute', top: 50, left: 0, right: 0,
                  backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CCC',
                  borderRadius: 4, elevation: 10, padding: 5, zIndex: 2000
                }}>
                  <FlatList
                    data={games}
                    keyExtractor={item => item.id.toString()}
                    renderItem={({ item }) => {
                      // Helper for Name/Color
                      const getGameDisplay = (g) => {
                        const timeStr = new Date(g.draw_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                        let displayName = g.name;
                        let color = '#2196F3'; // Default

                        // Logic to match Screenshot: D-1:00PM, K-3:00PM, etc.
                        if (timeStr.includes('1:00') || timeStr.includes('01:00')) {
                          displayName = 'D-1:00PM'; color = '#2962FF'; // Blue
                        } else if (timeStr.includes('3:00') || timeStr.includes('03:00')) {
                          displayName = 'K-3:00PM'; color = '#2E7D32'; // Green (K for 3pm)
                        } else if (timeStr.includes('6:00') || timeStr.includes('06:00')) {
                          displayName = 'D-6:00PM'; color = '#E91E63'; // Pink
                        } else if (timeStr.includes('8:00') || timeStr.includes('08:00')) {
                          displayName = 'D-8:00PM'; color = '#EF6C00'; // Orange
                        }
                        return { displayName, color };
                      };

                      const { displayName, color } = getGameDisplay(item);

                      return (
                        <TouchableOpacity
                          style={{
                            backgroundColor: color,
                            paddingVertical: 15,
                            marginBottom: 5,
                            borderRadius: 4,
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onPress={() => {
                            // We might want to save the "displayName" to the object or just use it for display?
                            // Let's mutate the item name for consistency in the UI if needed, 
                            // or just rely on re-calculating (better).
                            // Actually, let's store standard item but just Display formatted.
                            // Use a slight hack to store display name for the main input
                            item.displayName = displayName;
                            setSelectedGame(item);
                            setIsGameDropdownOpen(false);
                          }}
                        >
                          <Text style={{ fontSize: 22, color: '#FFF', fontWeight: 'bold' }}>
                            {displayName}
                          </Text>
                        </TouchableOpacity>
                      );
                    }}
                  />
                </View>
              )}
            </View>


            <View style={{ marginBottom: 10, zIndex: 1000 }}>
              <TouchableOpacity
                style={styles.inputWrapper}
                onPress={() => setIsAgentDropdownOpen(!isAgentDropdownOpen)}
              >
                <Text style={styles.inputText}>
                  {selectedSubUser ? selectedSubUser.username : (agent ? agent.username : 'Loading...')}
                </Text>
                <Ionicons name={isAgentDropdownOpen ? "caret-up" : "caret-down"} size={16} color="#666" />
              </TouchableOpacity>

              {isAgentDropdownOpen && (
                <View style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CCC',
                  borderRadius: 8, maxHeight: 200, elevation: 5
                }}>
                  <FlatList
                    data={subUsers}
                    keyExtractor={item => item.id.toString()}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#EEE' }}
                        onPress={() => {
                          setSelectedSubUser(item);
                          setIsAgentDropdownOpen(false);
                        }}
                      >
                        <Text style={{ fontSize: 16, color: '#333' }}>
                          {item.username} ({item.role}) - Bal: {item.balance}
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              )}
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
        </View>
      )}

      {/* VIEW: USER MANAGEMENT */}
      {currentView === 'users' && renderUsers()}

      {/* Side Menu Overlay (Moved to bottom for Z-Index) */}
      {isMenuOpen && (
        <TouchableOpacity
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 4000 }}
          onPress={toggleMenu}
        />
      )}
      {renderSideMenu()}

      {currentView === 'results' && (
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
      )}

      {currentView === 'reports' && (
        <View style={[styles.formContainer, { alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name="construct-outline" size={64} color="#999" />
          <Text style={{ marginTop: 20, fontSize: 18, color: '#666' }}>Reports Coming Soon</Text>
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
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: COLORS.primary, // Blue Header
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 10,
    height: 70, // Slightly shorter
    elevation: 4
  },
  statLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF', // White text on blue header
  },
  tabsContainer: {
    flexDirection: 'row',
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: '#FFF',
    marginLeft: 8,
    borderRadius: 4, // More square
    borderWidth: 0,
    elevation: 2
  },
  activeTab: {
    backgroundColor: COLORS.btnOrange, // Orange active tab maybe? Or just Blue
    borderWidth: 2,
    borderColor: '#FFF'
  },
  tabText: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  formContainer: {
    flex: 1,
    padding: 10,
    backgroundColor: '#F0F0F0', // Light Grey background
  },
  inputWrapper: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  inputText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '500'
  },
  checkboxRow: {
    flexDirection: 'row',
    marginBottom: 15,
    justifyContent: 'space-around'
  },
  inputsRow: {
    flexDirection: 'row',
    marginBottom: 15,
    gap: 10
  },
  inputField: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    color: COLORS.textPrimary,
    justifyContent: 'center'
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    marginHorizontal: 3,
    alignItems: 'center',
    borderRadius: 8,
    elevation: 2
  },
  actionBtnText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 15,
  },
  listContainer: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 5,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  ticketRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    alignItems: 'center',
    paddingHorizontal: 5
  },
  ticketText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary
  },
  dashboardBtnBlue: {
    backgroundColor: '#0D47A1', // Deep Blue
    padding: 15,
    borderRadius: 10,
    elevation: 3,
    marginBottom: 5
  },
  dashboardBtnLightBlue: {
    backgroundColor: '#1976D2', // Medium Blue
    padding: 15,
    borderRadius: 10,
    elevation: 3,
    marginBottom: 5
  },
  dashboardBtnSkyBlue: {
    backgroundColor: '#2196F3', // Light Blue
    padding: 15,
    borderRadius: 10,
    elevation: 3,
    marginBottom: 5
  },
  dashboardBtnText: {
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5'
  },
  menuText: {
    fontSize: 18,
    marginLeft: 20,
    color: '#333'
  }
});
