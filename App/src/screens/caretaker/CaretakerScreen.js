import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput, Modal } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import { caretakerAPI } from '../../services/api';
import { caretakerData as mockData } from '../../data/mockData';

const CaretakerScreen = ({ navigation }) => {
    const { theme } = useTheme();
    const colors = theme.colors;
    const insets = useSafeAreaInsets();

    const [patient, setPatient] = useState(mockData.patient);
    const [alerts, setAlerts] = useState(mockData.alerts);
    const [loading, setLoading] = useState(false);
    const [contacts, setContacts] = useState([]);
    const [showAddContact, setShowAddContact] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newRelation, setNewRelation] = useState('family');

    useFocusEffect(
        useCallback(() => {
            fetchCaretakerData();
            fetchContacts();
        }, [])
    );

    const fetchCaretakerData = async () => {
        setLoading(true);
        try {
            const [patientsRes, alertsRes] = await Promise.all([
                caretakerAPI.patients().catch(() => null),
                caretakerAPI.alerts().catch(() => null),
            ]);
            if (patientsRes?.data?.length > 0) {
                const p = patientsRes.data[0];
                const detail = await caretakerAPI.patientDetail(p.id).catch(() => null);
                if (detail?.data) {
                    setPatient({
                        name: detail.data.patient?.name || p.name,
                        status: detail.data.adherence >= 80 ? 'Adherent' : 'Needs Attention',
                        lastSeen: '5 mins ago',
                        adherence: detail.data.adherence || 0,
                        lastTaken: detail.data.lastTaken || '—',
                        lastTakenStatus: detail.data.adherence >= 80 ? 'On time' : 'Late',
                    });
                }
            }
            if (alertsRes?.data?.length > 0) {
                setAlerts(alertsRes.data.map(a => ({
                    id: a.id,
                    type: a.type === 'emergency' ? 'error' : a.type,
                    title: a.title,
                    description: a.description,
                    time: a.time_ago || a.created_at,
                })));
            }
        } catch (err) {
            console.log('Caretaker fetch failed:', err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchContacts = async () => {
        try {
            const res = await caretakerAPI.listContacts();
            if (res?.data) {
                setContacts(res.data);
                // Cache locally for offline SMS
                const { cacheContacts } = require('../../services/smsService');
                await cacheContacts(res.data);
            }
        } catch (err) {
            // Fallback to cached contacts
            const { getCachedContacts } = require('../../services/smsService');
            const cached = await getCachedContacts();
            if (cached.length > 0) setContacts(cached);
        }
    };

    const handleAddContact = async () => {
        if (!newName.trim() || !newPhone.trim()) {
            Alert.alert('Required', 'Please enter both name and phone number');
            return;
        }
        try {
            await caretakerAPI.addContact(newName.trim(), newPhone.trim(), newRelation);
            Alert.alert('✅ Added', `${newName} will automatically receive SMS alerts when you miss 3 doses.`);
            setNewName('');
            setNewPhone('');
            setNewRelation('family');
            setShowAddContact(false);
            fetchContacts();
        } catch (err) {
            Alert.alert('Error', err.message || 'Failed to add contact');
        }
    };

    const handleDeleteContact = (contact) => {
        Alert.alert('Remove Contact', `Remove ${contact.name} (${contact.phone})?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove', style: 'destructive',
                onPress: async () => {
                    try {
                        await caretakerAPI.deleteContact(contact.id);
                        fetchContacts();
                    } catch (err) {
                        Alert.alert('Error', 'Failed to remove');
                    }
                },
            },
        ]);
    };

    const getAlertStyle = (type) => {
        switch (type) {
            case 'error': return { bgColor: colors.errorLight || '#FFEBEE', iconColor: colors.error || '#F44336', icon: 'alert-circle' };
            case 'info': return { bgColor: colors.infoLight || '#E3F2FD', iconColor: colors.info || '#2196F3', icon: 'plus-circle' };
            case 'success': return { bgColor: colors.accent, iconColor: colors.primary, icon: 'check-circle' };
            default: return { bgColor: colors.accent, iconColor: colors.primary, icon: 'information' };
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Header title="Caretaker Dashboard" showBack onBackPress={() => navigation.goBack()} rightIcon="cog" />

            <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 80 }} showsVerticalScrollIndicator={false}>
                {loading && <ActivityIndicator style={{ marginVertical: 10 }} color={colors.primary} />}

                {/* ── Caretaker Contacts ─────────────────── */}
                <View style={[styles.section, { marginTop: 4 }]}>
                    <View style={styles.sectionHeader}>
                        <Text style={[theme.typography.h3, { color: colors.text }]}>👥 Caretaker Contacts</Text>
                        <TouchableOpacity
                            style={[styles.addBtn, { backgroundColor: colors.primary }]}
                            onPress={() => setShowAddContact(true)}
                            activeOpacity={0.7}
                        >
                            <MaterialCommunityIcons name="plus" size={16} color="#fff" />
                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12, marginLeft: 4 }}>Add</Text>
                        </TouchableOpacity>
                    </View>

                    {contacts.length === 0 ? (
                        <TouchableOpacity
                            style={[styles.emptyContactCard, { backgroundColor: colors.surface, borderColor: colors.primary + '40' }]}
                            onPress={() => setShowAddContact(true)}
                            activeOpacity={0.7}
                        >
                            <MaterialCommunityIcons name="account-plus" size={32} color={colors.primary} />
                            <Text style={[theme.typography.body, { color: colors.text, fontWeight: '600', marginTop: 8 }]}>
                                Add Caretaker Contact
                            </Text>
                            <Text style={[theme.typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>
                                Enter name & phone number. They'll automatically get SMS when you miss 3 doses.
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        contacts.map(contact => (
                            <View key={contact.id} style={[styles.contactCard, { backgroundColor: colors.surface }, theme.shadows.small]}>
                                <View style={[styles.contactAvatar, { backgroundColor: colors.primary + '15' }]}>
                                    <MaterialCommunityIcons name="account" size={24} color={colors.primary} />
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={[theme.typography.h4, { color: colors.text }]}>{contact.name}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                        <MaterialCommunityIcons name="phone" size={12} color={colors.textSecondary} />
                                        <Text style={[theme.typography.bodySmall, { color: colors.textSecondary, marginLeft: 4 }]}>
                                            {contact.phone}
                                        </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                        <MaterialCommunityIcons name="message-text" size={12} color={colors.primary} />
                                        <Text style={[theme.typography.caption, { color: colors.primary, marginLeft: 4 }]}>
                                            Auto SMS on 3 missed doses
                                        </Text>
                                    </View>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <View style={[styles.relationBadge, { backgroundColor: colors.accent }]}>
                                        <Text style={[theme.typography.caption, { color: colors.primary, fontWeight: '600', textTransform: 'capitalize' }]}>
                                            {contact.relationship}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => handleDeleteContact(contact)}
                                        style={{ marginTop: 8 }}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.error || '#F44336'} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </View>

                {/* How It Works */}
                <View style={[styles.infoCard, { backgroundColor: colors.surface }, theme.shadows.small]}>
                    <MaterialCommunityIcons name="shield-check" size={24} color={colors.primary} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[theme.typography.h4, { color: colors.text }]}>How Auto SMS Works</Text>
                        <Text style={[theme.typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                            SMS is automatically sent to your caretaker when:
                        </Text>
                        <Text style={[theme.typography.caption, { color: colors.text, marginTop: 4 }]}>
                            📱  You don't respond to 3 alarm reminders
                        </Text>
                        <Text style={[theme.typography.caption, { color: colors.text, marginTop: 2 }]}>
                            💊  You miss a critical medicine (heart/BP)
                        </Text>
                        <Text style={[theme.typography.caption, { color: colors.text, marginTop: 2 }]}>
                            ⏰  3+ scheduled doses pass without action
                        </Text>
                        <Text style={[theme.typography.caption, { color: colors.primary, marginTop: 6, fontWeight: '600' }]}>
                            No manual action needed — it's fully automatic!
                        </Text>
                    </View>
                </View>

                {/* Stats */}
                <View style={styles.statsRow}>
                    <View style={[styles.statCard, { backgroundColor: colors.surface }, theme.shadows.small]}>
                        <View style={styles.statHeader}>
                            <MaterialCommunityIcons name="check-circle" size={18} color={colors.primary} />
                            <Text style={[theme.typography.caption, { color: colors.primary, marginLeft: 4 }]}>ADHERENCE</Text>
                        </View>
                        <Text style={[theme.typography.number, { color: colors.text }]}>{patient.adherence}%</Text>
                        <Text style={[theme.typography.bodySmall, { color: colors.textSecondary }]}>This month</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: colors.surface }, theme.shadows.small]}>
                        <View style={styles.statHeader}>
                            <MaterialCommunityIcons name="clock-outline" size={18} color={colors.info || '#2196F3'} />
                            <Text style={[theme.typography.caption, { color: colors.info || '#2196F3', marginLeft: 4 }]}>LAST TAKEN</Text>
                        </View>
                        <Text style={[theme.typography.number, { color: colors.text }]}>{patient.lastTaken}</Text>
                        <Text style={[theme.typography.bodySmall, { color: colors.textSecondary }]}>{patient.lastTakenStatus}</Text>
                    </View>
                </View>

                {/* Alert History */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={[theme.typography.h3, { color: colors.text }]}>Alert History</Text>
                    </View>
                    {alerts.map((alert) => {
                        const s = getAlertStyle(alert.type);
                        return (
                            <View key={alert.id} style={[styles.alertItem, { borderBottomColor: colors.border }]}>
                                <View style={[styles.alertIcon, { backgroundColor: s.bgColor }]}>
                                    <MaterialCommunityIcons name={s.icon} size={18} color={s.iconColor} />
                                </View>
                                <View style={styles.alertContent}>
                                    <Text style={[theme.typography.h4, { color: colors.text }]}>{alert.title}</Text>
                                    <Text style={[theme.typography.bodySmall, { color: colors.textSecondary }]} numberOfLines={2}>{alert.description}</Text>
                                </View>
                                <Text style={[theme.typography.caption, { color: colors.textTertiary }]}>{alert.time}</Text>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>

            {/* ── Add Contact Modal ──────────────────────── */}
            <Modal visible={showAddContact} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[theme.typography.h2, { color: colors.text }]}>Add Caretaker</Text>
                            <TouchableOpacity onPress={() => setShowAddContact(false)}>
                                <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <Text style={[theme.typography.bodySmall, { color: colors.textSecondary, marginBottom: 20 }]}>
                            Enter your caretaker's details. SMS will be sent automatically when you miss doses.
                        </Text>

                        <Text style={[theme.typography.caption, { color: colors.textSecondary, marginBottom: 4, fontWeight: '700' }]}>NAME</Text>
                        <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
                            <MaterialCommunityIcons name="account" size={18} color={colors.primary} />
                            <TextInput
                                value={newName}
                                onChangeText={setNewName}
                                placeholder="e.g. Mom, Dad, Dr. Sharma"
                                placeholderTextColor={colors.textTertiary}
                                style={[styles.input, { color: colors.text }]}
                            />
                        </View>

                        <Text style={[theme.typography.caption, { color: colors.textSecondary, marginBottom: 4, marginTop: 14, fontWeight: '700' }]}>PHONE NUMBER</Text>
                        <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
                            <MaterialCommunityIcons name="phone" size={18} color={colors.primary} />
                            <TextInput
                                value={newPhone}
                                onChangeText={setNewPhone}
                                placeholder="+91 98765 43210"
                                placeholderTextColor={colors.textTertiary}
                                keyboardType="phone-pad"
                                style={[styles.input, { color: colors.text }]}
                            />
                        </View>

                        <Text style={[theme.typography.caption, { color: colors.textSecondary, marginBottom: 8, marginTop: 14, fontWeight: '700' }]}>RELATIONSHIP</Text>
                        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                            {['family', 'spouse', 'parent', 'sibling', 'doctor', 'friend'].map(rel => (
                                <TouchableOpacity
                                    key={rel}
                                    style={[styles.relChip, {
                                        backgroundColor: newRelation === rel ? colors.primary : colors.background,
                                        borderColor: newRelation === rel ? colors.primary : colors.border,
                                    }]}
                                    onPress={() => setNewRelation(rel)}
                                >
                                    <Text style={{
                                        color: newRelation === rel ? '#fff' : colors.textSecondary,
                                        fontSize: 12, fontWeight: '600', textTransform: 'capitalize',
                                    }}>
                                        {rel}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                            onPress={handleAddContact}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons name="check" size={20} color="#fff" />
                            <Text style={[theme.typography.h4, { color: '#fff', marginLeft: 8 }]}>Save Caretaker Contact</Text>
                        </TouchableOpacity>

                        <Text style={[theme.typography.caption, { color: colors.textTertiary, textAlign: 'center', marginTop: 12 }]}>
                            📱 SMS will be sent to this number automatically
                        </Text>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    section: { paddingHorizontal: 20, marginBottom: 20 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    addBtn: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    },
    contactCard: {
        flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, marginBottom: 10,
    },
    contactAvatar: {
        width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    },
    relationBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    emptyContactCard: {
        borderRadius: 16, padding: 24, alignItems: 'center',
        borderWidth: 1.5, borderStyle: 'dashed',
    },
    infoCard: {
        flexDirection: 'row', borderRadius: 16, padding: 16, marginHorizontal: 20, marginBottom: 20,
    },
    statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 20 },
    statCard: { flex: 1, borderRadius: 16, padding: 16 },
    statHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    alertItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
    alertIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    alertContent: { flex: 1 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContainer: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    inputRow: {
        flexDirection: 'row', alignItems: 'center', borderRadius: 12,
        borderWidth: 1, paddingHorizontal: 14, height: 48, gap: 10,
    },
    input: { flex: 1, height: '100%', fontSize: 15 },
    relChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    saveBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        borderRadius: 14, paddingVertical: 16, marginTop: 20,
    },
});

export default CaretakerScreen;
