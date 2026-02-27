import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Switch, StyleSheet, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import ReminderCard from '../../components/ReminderCard';
import { remindersAPI, dosesAPI, medicinesAPI } from '../../services/api';

const RemindersScreen = ({ navigation }) => {
    const { theme } = useTheme();
    const colors = theme.colors;
    const insets = useSafeAreaInsets();
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [upcoming, setUpcoming] = useState([]);
    const [completed, setCompleted] = useState([]);
    const [loading, setLoading] = useState(false);

    useFocusEffect(
        useCallback(() => {
            fetchReminders();
        }, [])
    );

    const fetchReminders = async () => {
        setLoading(true);
        try {
            const res = await remindersAPI.list();
            if (res.data) {
                setUpcoming(res.data.upcoming || []);
                setCompleted(res.data.completed || []);
            }

            // If no reminders exist yet, build from medicine schedules
            if ((!res.data?.upcoming || res.data.upcoming.length === 0) &&
                (!res.data?.completed || res.data.completed.length === 0)) {
                await buildFromMedicines();
            }
        } catch (err) {
            // Try building from medicines as fallback
            await buildFromMedicines();
        } finally {
            setLoading(false);
        }
    };

    // Generate default schedules from frequency (mirrors backend logic)
    const getDefaultSchedules = (frequency, instruction) => {
        const freq = (frequency || '').toLowerCase();
        const timing = (instruction || '').toLowerCase();
        let times;
        if (freq.includes('twice')) times = ['08:00', '20:00'];
        else if (freq.includes('three')) times = ['08:00', '14:00', '20:00'];
        else if (freq.includes('four')) times = ['08:00', '12:00', '16:00', '20:00'];
        else times = ['08:00'];

        if (timing.includes('before food')) {
            times = times.map(t => {
                const [h] = t.split(':').map(Number);
                return `${String(h === 8 ? 7 : h === 14 ? 13 : h === 20 ? 19 : h).padStart(2, '0')}:30`;
            });
        } else if (timing.includes('after food')) {
            times = times.map(t => {
                const [h] = t.split(':').map(Number);
                return `${String(h).padStart(2, '0')}:30`;
            });
        }
        return times;
    };

    const buildFromMedicines = async () => {
        try {
            const medRes = await medicinesAPI.list();
            if (medRes.data && medRes.data.length > 0) {
                const now = new Date();
                const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

                const upcomingList = [];
                const completedList = [];

                for (const med of medRes.data) {
                    const schedules = (med.schedule && med.schedule.length > 0)
                        ? med.schedule
                        : getDefaultSchedules(med.frequency, med.instruction);

                    for (const time of schedules) {
                        const [h, m] = time.split(':').map(Number);
                        const target = new Date();
                        target.setHours(h, m, 0, 0);
                        const diff = target - now;

                        // Format IST time
                        const hDisplay = h % 12 || 12;
                        const ampm = h >= 12 ? 'PM' : 'AM';
                        const timeIST = `${hDisplay}:${String(m).padStart(2, '0')} ${ampm} IST`;

                        // Countdown text
                        let countdown = '';
                        if (diff > 0) {
                            const hLeft = Math.floor(diff / 3600000);
                            const mLeft = Math.floor((diff % 3600000) / 60000);
                            countdown = hLeft > 0 ? `in ${hLeft}h ${mLeft}m` : `in ${mLeft} min`;
                        }

                        // Take Now only shows within 30 min of scheduled time
                        const isNearTime = diff <= 30 * 60 * 1000 && diff >= -60 * 60 * 1000;

                        const entry = {
                            id: `${med.id}-${time}`,
                            medicine_id: med.id,
                            medicine_name: med.name,
                            dosage: med.dosage,
                            scheduled_time: timeIST,
                            countdown: countdown,
                            isNearTime: isNearTime,
                            instruction: med.instruction || `${med.pill_count || 1} ${med.type || 'pill'}`,
                            type: med.type || 'Oral Tablet',
                            pill_count: med.pill_count || 1,
                            icon: med.icon || 'pill',
                            status: 'upcoming',
                        };

                        if (time < currentTime) {
                            entry.status = 'missed';
                            completedList.push(entry);
                        } else {
                            upcomingList.push(entry);
                        }
                    }
                }

                // Sort by time
                upcomingList.sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''));
                setUpcoming(upcomingList);
                setCompleted(completedList);
            }
        } catch (e) {
            // No medicines yet — show empty state
        }
    };

    const handleTakeNow = async (reminder) => {
        // Immediately update local state — move from upcoming to completed
        setUpcoming(prev => prev.filter(r => r.id !== reminder.id));
        setCompleted(prev => [{
            ...reminder,
            status: 'completed',
            taken_time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }, ...prev]);

        try {
            // Log the dose via the API
            const medId = reminder.medicine_id;
            const time = reminder.scheduled_time;
            if (medId && time) {
                await dosesAPI.log(medId, time, 'taken');
            }

            // Try marking reminder as taken in DB
            if (reminder.id && typeof reminder.id === 'number') {
                try { await remindersAPI.take(reminder.id, medId); } catch (e) { }
            }
        } catch (err) {
            // Revert on failure
            Alert.alert('Error', err.message || 'Failed to log dose');
            fetchReminders();
        }
    };

    const handleSnooze = async (reminder) => {
        // Immediately update local state
        setUpcoming(prev => prev.filter(r => r.id !== reminder.id));
        Alert.alert('Snoozed', `${reminder.medicine_name} snoozed for 10 minutes.`);

        try {
            if (reminder.id && typeof reminder.id === 'number') {
                await remindersAPI.snooze(reminder.id, reminder.medicine_id);
            }
        } catch (err) {
            fetchReminders();
        }
    };

    const handleDeleteMedicine = (reminder) => {
        const medId = reminder.medicine_id;
        if (!medId) return;
        Alert.alert(
            'Delete Medicine',
            `Delete "${reminder.medicine_name}"? This removes all schedules and reminders.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive',
                    onPress: async () => {
                        try {
                            await medicinesAPI.delete(medId);
                            setUpcoming(prev => prev.filter(r => r.medicine_id !== medId));
                            setCompleted(prev => prev.filter(r => r.medicine_id !== medId));
                        } catch (err) {
                            Alert.alert('Error', 'Failed to delete medicine.');
                        }
                    },
                },
            ]
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Header title="Smart Reminders" showBack onBackPress={() => navigation.goBack()} />

            <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 80 }} showsVerticalScrollIndicator={false}>
                {/* Voice toggle */}
                <View style={[styles.voiceToggle, { backgroundColor: colors.surface }, theme.shadows.small]}>
                    <View style={styles.voiceLeft}>
                        <MaterialCommunityIcons name="microphone" size={20} color={colors.primary} />
                        <Text style={[theme.typography.body, { color: colors.text, fontWeight: '600', marginLeft: 8 }]}>
                            Voice Reminders
                        </Text>
                    </View>
                    <Switch
                        value={voiceEnabled}
                        onValueChange={setVoiceEnabled}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor="#FFFFFF"
                    />
                </View>

                {loading && <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />}

                {/* Upcoming */}
                <View style={styles.section}>
                    <Text style={[theme.typography.h3, { color: colors.text, marginBottom: 12 }]}>
                        Upcoming ({upcoming.length})
                    </Text>
                    {upcoming.length === 0 && !loading && (
                        <View style={{ alignItems: 'center', marginTop: 40, marginBottom: 20 }}>
                            <MaterialCommunityIcons name="bell-off-outline" size={48} color={colors.textTertiary} />
                            <Text style={[theme.typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: 12 }]}>
                                No upcoming reminders.
                            </Text>
                            <Text style={[theme.typography.bodySmall, { color: colors.textTertiary, textAlign: 'center', marginTop: 4 }]}>
                                Add medicines with schedule times to see reminders here.
                            </Text>
                            <TouchableOpacity
                                style={{ marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}
                                onPress={() => navigation.navigate('Scanner')}
                            >
                                <Text style={{ color: '#fff', fontWeight: '600' }}>Scan Prescription</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    {upcoming.map((r, i) => (
                        <View key={r.id || i}>
                            <ReminderCard
                                reminder={{
                                    medicineName: r.medicine_name || 'Medicine',
                                    time: r.scheduled_time || 'Not set',
                                    instruction: r.instruction || `${r.pill_count || 1} ${r.type || 'pill'}`,
                                    status: r.status || 'upcoming',
                                    icon: r.icon || 'pill',
                                    type: r.type,
                                    countdown: r.countdown || '',
                                    isNearTime: r.isNearTime || false,
                                }}
                                onTakeNow={() => handleTakeNow(r)}
                                onSnooze={() => handleSnooze(r)}
                            />
                            <TouchableOpacity
                                onPress={() => handleDeleteMedicine(r)}
                                style={[styles.deleteRow, { backgroundColor: colors.error + '10' }]}
                            >
                                <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.error || '#F44336'} />
                                <Text style={[theme.typography.caption, { color: colors.error, marginLeft: 6, fontWeight: '600' }]}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>

                {/* Completed */}
                {completed.length > 0 && (
                    <View style={styles.section}>
                        <Text style={[theme.typography.h3, { color: colors.text, marginBottom: 12 }]}>
                            Earlier ({completed.length})
                        </Text>
                        {completed.map((r, i) => (
                            <ReminderCard
                                key={r.id || i}
                                reminder={{
                                    medicineName: r.medicine_name || 'Medicine',
                                    time: r.scheduled_time || '',
                                    instruction: r.instruction || `${r.pill_count || 1} ${r.type || 'pill'}`,
                                    status: r.status === 'completed' ? 'completed' : 'missed',
                                    icon: r.status === 'completed' ? '✅' : '⏰',
                                }}
                                onTakeNow={() => handleTakeNow(r)}
                            />
                        ))}
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    voiceToggle: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginHorizontal: 20, borderRadius: 14, padding: 14, marginBottom: 16,
    },
    voiceLeft: { flexDirection: 'row', alignItems: 'center' },
    section: { paddingHorizontal: 20, marginBottom: 20 },
    deleteRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        borderRadius: 10, paddingVertical: 8, marginTop: -6, marginBottom: 12,
    },
});

export default RemindersScreen;
