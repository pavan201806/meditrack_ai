import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import ProgressRing from '../../components/ProgressRing';
import CountdownTimer from '../../components/CountdownTimer';
import StatCard from '../../components/StatCard';
import RefillAlertCard from '../../components/RefillAlertCard';
import { dashboardAPI, medicinesAPI, analyticsAPI, dosesAPI, caretakerAPI } from '../../services/api';
import { cacheDashboard, getCachedDashboard } from '../../services/offlineCache';
import * as Speech from 'expo-speech';
import MedicineAlarm from '../../components/MedicineAlarm';
import { rescheduleAllNotifications } from '../../services/notificationService';
import { saveMedicineSchedule, logDoseTaken } from '../../services/backgroundDoseMonitor';
import AIFloatingMenu from '../../components/AIFloatingMenu';

const { width } = Dimensions.get('window');

const DashboardScreen = ({ navigation }) => {
    const { theme } = useTheme();
    const colors = theme.colors;
    const insets = useSafeAreaInsets();

    const [stats, setStats] = useState({ adherencePercentage: 0, streak: 0, status: '--', dosesLeft: 0 });
    const [nextDose, setNextDose] = useState(null);
    const [refills, setRefills] = useState([]);
    const [riskScore, setRiskScore] = useState(null);
    const [medicines, setMedicines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [countdownText, setCountdownText] = useState('');
    const voiceAnnouncedRef = useRef(null);
    const [alarmVisible, setAlarmVisible] = useState(false);
    const [alarmMedicine, setAlarmMedicine] = useState(null);

    useFocusEffect(
        useCallback(() => {
            fetchAll();
            dosesAPI.sync().catch(() => { });
        }, [])
    );

    const fetchAll = async () => {
        setLoading(true);
        await Promise.all([
            fetchDashboard(),
            fetchRefills(),
            fetchRisk(),
            fetchMedicines(),
        ]);
        setLoading(false);
    };

    const fetchDashboard = async () => {
        try {
            const res = await dashboardAPI.get();
            if (res.data) {
                setStats({
                    adherencePercentage: res.data.adherencePercentage || 0,
                    streak: res.data.streak || 0,
                    status: res.data.status || 'No Data',
                    dosesLeft: res.data.dosesLeft || 0,
                });
                cacheDashboard(res.data);

                if (res.data.nextDose) {
                    setNextDose({
                        medicine: res.data.nextDose.medicine,
                        dosage: res.data.nextDose.dosage,
                        instruction: res.data.nextDose.instruction || '',
                        targetTime: new Date(res.data.nextDose.target_time),
                    });
                }
            }
        } catch (err) {
            const cached = await getCachedDashboard();
            if (cached) setStats(cached);
        }
    };

    const fetchRefills = async () => {
        try {
            const res = await medicinesAPI.refills();
            if (res.data?.refills) setRefills(res.data.refills);
        } catch (e) { }
    };

    const fetchRisk = async () => {
        try {
            const res = await analyticsAPI.risk();
            if (res.data) setRiskScore(res.data);
        } catch (e) { }
    };

    const fetchMedicines = async () => {
        try {
            const res = await medicinesAPI.list();
            if (res.data) {
                setMedicines(res.data);
                // Schedule background notifications for all medicines
                rescheduleAllNotifications(res.data).catch(err =>
                    console.log('Notification scheduling failed:', err.message)
                );
                // Save schedule for background dose monitor
                saveMedicineSchedule(res.data).catch(err =>
                    console.log('Schedule save failed:', err.message)
                );
            }
        } catch (e) { }
    };

    const handleDeleteMedicine = (med) => {
        Alert.alert(
            'Delete Medicine',
            `Delete "${med.name}"? This removes all schedules and reminders.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive',
                    onPress: async () => {
                        try {
                            await medicinesAPI.delete(med.id);
                            const remaining = medicines.filter(m => m.id !== med.id);
                            setMedicines(remaining);
                            // Reschedule notifications without deleted medicine
                            rescheduleAllNotifications(remaining).catch(() => { });
                            // Reset next dose if deleted medicine was the next dose
                            if (nextDose && nextDose.medicineId === med.id) {
                                setNextDose(null);
                            }
                        } catch (err) {
                            Alert.alert('Error', 'Failed to delete medicine.');
                        }
                    },
                },
            ]
        );
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

    // Convert 24h time to AM/PM IST
    const formatTimeIST = (time24) => {
        const [h, m] = time24.split(':').map(Number);
        const hDisplay = h % 12 || 12;
        const ampm = h >= 12 ? 'PM' : 'AM';
        return `${hDisplay}:${String(m).padStart(2, '0')} ${ampm}`;
    };

    // Build next dose from medicines if API didn't return one
    const getNextDoseDisplay = () => {
        if (nextDose) return nextDose;

        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        let closest = null;
        for (const med of medicines) {
            const schedules = (med.schedule && med.schedule.length > 0)
                ? med.schedule
                : getDefaultSchedules(med.frequency, med.instruction);

            for (const time of schedules) {
                if (time > currentTime) {
                    if (!closest || time < closest.time) {
                        const [h, m] = time.split(':').map(Number);
                        const target = new Date();
                        target.setHours(h, m, 0, 0);
                        const hDisplay = h % 12 || 12;
                        const ampm = h >= 12 ? 'PM' : 'AM';
                        closest = {
                            medicine: med.name,
                            dosage: med.dosage,
                            instruction: med.instruction || med.frequency || '',
                            targetTime: target,
                            time: time,
                            timeIST: `${hDisplay}:${String(m).padStart(2, '0')} ${ampm} IST`,
                            medicineId: med.id,
                        };
                    }
                }
            }
        }
        return closest;
    };

    const getRiskColor = (level) => {
        if (level === 'high') return '#F44336';
        if (level === 'medium') return '#FF9800';
        return '#4CAF50';
    };

    const nextDoseDisplay = getNextDoseDisplay();

    // Live countdown refresh every 30 seconds + voice announcement
    useEffect(() => {
        const updateCountdown = () => {
            if (!nextDoseDisplay || !nextDoseDisplay.targetTime) {
                setCountdownText('');
                return;
            }
            const now = new Date();
            const diff = nextDoseDisplay.targetTime - now;

            // Trigger alarm when it's time (within 30 sec window)
            if (diff <= 30000 && diff >= -30000) {
                const doseKey = `${nextDoseDisplay.medicine}-${nextDoseDisplay.time}`;
                if (voiceAnnouncedRef.current !== doseKey) {
                    voiceAnnouncedRef.current = doseKey;
                    // Show full alarm modal
                    setAlarmMedicine({
                        name: nextDoseDisplay.medicine,
                        dosage: nextDoseDisplay.dosage,
                        instruction: nextDoseDisplay.instruction,
                        time: nextDoseDisplay.time,
                        timeIST: nextDoseDisplay.timeIST,
                        medicineId: nextDoseDisplay.medicineId,
                    });
                    setAlarmVisible(true);
                }
                setCountdownText('Now!');
                return;
            }

            // 5 min warning voice
            if (diff > 0 && diff <= 5 * 60 * 1000) {
                const warnKey = `warn-${nextDoseDisplay.medicine}-${nextDoseDisplay.time}`;
                if (voiceAnnouncedRef.current !== warnKey) {
                    voiceAnnouncedRef.current = warnKey;
                    Speech.speak(`${Math.ceil(diff / 60000)} minutes until ${nextDoseDisplay.medicine}`, {
                        language: 'en-IN', pitch: 1.0, rate: 0.9,
                    });
                }
            }

            if (diff <= 0) {
                setCountdownText('Now!');
                return;
            }
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            setCountdownText(h > 0 ? `in ${h}h ${m}m` : `in ${m} min`);
        };
        updateCountdown();
        const interval = setInterval(updateCountdown, 15000); // check every 15s for voice
        return () => clearInterval(interval);
    }, [nextDoseDisplay]);

    // Handle alarm dismiss
    const handleAlarmDismiss = async (action) => {
        setAlarmVisible(false);
        if (action === 'taken' && alarmMedicine) {
            try {
                const medId = alarmMedicine.medicineId;
                const time = alarmMedicine.time;
                if (medId && time) {
                    await dosesAPI.log(medId, time, 'taken');
                    // Log dose for background monitor
                    await logDoseTaken(medId, time);
                }
            } catch (err) {
                console.log('Dose log failed:', err.message);
            }
            fetchAll();
        } else if (action === 'auto_sms') {
            // Patient didn't respond after all cycles → log as MISSED + send Twilio alert

            // 1. Log the dose as MISSED in analytics
            try {
                const medId = alarmMedicine?.medicineId;
                const time = alarmMedicine?.time;
                if (medId && time) {
                    await dosesAPI.log(medId, time, 'missed');
                    console.log('📊 Dose logged as MISSED:', alarmMedicine?.name);
                }
            } catch (err) {
                console.log('Missed dose log failed:', err.message);
            }

            // 2. Send SMS + Call via backend Twilio
            try {
                const missedMeds = [{ name: alarmMedicine?.name || 'Medicine', dosage: alarmMedicine?.dosage || '' }];
                await caretakerAPI.emergencyAutoSMS(missedMeds);
                console.log('✅ Twilio emergency alert sent via backend');
            } catch (err) {
                console.log('Auto Twilio alert failed, trying fallback:', err.message);
                try {
                    await caretakerAPI.emergencyTrigger(null, 'auto_sms');
                } catch (fallbackErr) {
                    console.log('Fallback also failed:', fallbackErr.message);
                }
            }

            // 3. Refresh dashboard to reflect missed dose
            fetchAll();
        }
        setAlarmMedicine(null);
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <ScrollView
                style={[styles.container, { backgroundColor: colors.background }]}
                contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
                    <View>
                        <Text style={[theme.typography.bodySmall, { color: colors.textSecondary, fontStyle: 'italic' }]}>Welcome Back,</Text>
                        <Text style={[theme.typography.h1, { color: colors.text }]}>MediTrack AI</Text>
                    </View>
                    <TouchableOpacity style={[styles.notificationBtn, { backgroundColor: colors.surface }]}>
                        <MaterialCommunityIcons name="bell-outline" size={22} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {loading && <ActivityIndicator style={{ marginVertical: 20 }} color={colors.primary} />}

                {/* Refill Alerts */}
                <RefillAlertCard refills={refills} onPress={() => { }} />

                {/* Risk Card */}
                {riskScore && riskScore.risk_score > 20 && (
                    <View style={[styles.riskCard, { backgroundColor: getRiskColor(riskScore.risk_level) + '15', borderColor: getRiskColor(riskScore.risk_level) + '40' }]}>
                        <View style={styles.riskHeader}>
                            <MaterialCommunityIcons name="shield-alert" size={18} color={getRiskColor(riskScore.risk_level)} />
                            <Text style={[theme.typography.h4, { color: getRiskColor(riskScore.risk_level), marginLeft: 6 }]}>
                                Risk: {riskScore.risk_level.toUpperCase()} ({riskScore.risk_score}%)
                            </Text>
                        </View>
                        <Text style={[theme.typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                            {riskScore.prediction}
                        </Text>
                    </View>
                )}

                {/* Adherence Card */}
                <View style={[styles.adherenceCard, { backgroundColor: colors.surface }, theme.shadows.medium]}>
                    <View style={styles.progressContainer}>
                        <ProgressRing size={160} strokeWidth={14} progress={stats.adherencePercentage}>
                            <Text style={[theme.typography.number, { color: colors.text, fontSize: 36 }]}>{stats.adherencePercentage}%</Text>
                            <Text style={[theme.typography.bodySmall, { color: colors.textSecondary }]}>Weekly Adherence</Text>
                        </ProgressRing>
                    </View>

                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={[theme.typography.caption, { color: colors.textTertiary }]}>Streak</Text>
                            <View style={styles.statValueRow}>
                                <MaterialCommunityIcons name="fire" size={16} color="#FF9800" />
                                <Text style={[theme.typography.h4, { color: colors.text, marginLeft: 4 }]}>{stats.streak} Days</Text>
                            </View>
                        </View>
                        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                        <View style={styles.statItem}>
                            <Text style={[theme.typography.caption, { color: colors.textTertiary }]}>Status</Text>
                            <View style={styles.statValueRow}>
                                <MaterialCommunityIcons name="trending-up" size={16} color={colors.primary} />
                                <Text style={[theme.typography.h4, { color: colors.text, marginLeft: 4 }]}>{stats.status}</Text>
                            </View>
                        </View>
                        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                        <View style={styles.statItem}>
                            <Text style={[theme.typography.caption, { color: colors.textTertiary }]}>Left</Text>
                            <View style={styles.statValueRow}>
                                <MaterialCommunityIcons name="pill" size={16} color={colors.info} />
                                <Text style={[theme.typography.h4, { color: colors.text, marginLeft: 4 }]}>{stats.dosesLeft} Doses</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Quick Actions */}
                <View style={styles.quickActions}>
                    <TouchableOpacity style={[styles.actionCard, { backgroundColor: colors.surface }, theme.shadows.small]} onPress={() => navigation.navigate('Scanner')} activeOpacity={0.7}>
                        <View style={[styles.actionIcon, { backgroundColor: colors.accent }]}>
                            <MaterialCommunityIcons name="qrcode-scan" size={24} color={colors.primary} />
                        </View>
                        <Text style={[theme.typography.bodySmall, { color: colors.text, fontWeight: '600', marginTop: 8 }]}>Scan Medicine</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionCard, { backgroundColor: colors.surface }, theme.shadows.small]} onPress={() => navigation.navigate('Reminders')} activeOpacity={0.7}>
                        <View style={[styles.actionIcon, { backgroundColor: '#E3F2FD' }]}>
                            <MaterialCommunityIcons name="bell-ring" size={24} color="#2196F3" />
                        </View>
                        <Text style={[theme.typography.bodySmall, { color: colors.text, fontWeight: '600', marginTop: 8 }]}>Reminders</Text>
                    </TouchableOpacity>
                </View>

                {/* Next Dose */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={[theme.typography.h3, { color: colors.text }]}>Next Dose</Text>
                        <Text style={[theme.typography.bodySmall, { color: colors.primary, fontWeight: '600' }]}>
                            {nextDoseDisplay ? (countdownText || 'Upcoming') : 'None scheduled'}
                        </Text>
                    </View>

                    {nextDoseDisplay ? (
                        <View style={[styles.nextDoseCard, { backgroundColor: colors.countdown }]}>
                            <View style={styles.nextDoseInfo}>
                                <View style={[styles.nextDoseIcon, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                                    <MaterialCommunityIcons name="pill" size={20} color="#fff" />
                                </View>
                                <View style={{ marginLeft: 12, flex: 1 }}>
                                    <Text style={[theme.typography.h3, { color: '#fff' }]} numberOfLines={1}>{nextDoseDisplay.medicine}</Text>
                                    <Text style={[theme.typography.bodySmall, { color: 'rgba(255,255,255,0.7)' }]} numberOfLines={1}>
                                        {nextDoseDisplay.dosage}{nextDoseDisplay.instruction ? ` • ${nextDoseDisplay.instruction}` : ''}
                                    </Text>
                                </View>
                                <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 }}>
                                    <Text style={[theme.typography.bodySmall, { color: '#fff', fontWeight: '700' }]}>
                                        {nextDoseDisplay.timeIST || nextDoseDisplay.time}
                                    </Text>
                                </View>
                            </View>
                            <CountdownTimer targetTime={nextDoseDisplay.targetTime} />
                        </View>
                    ) : (
                        <View style={[styles.emptyNextDose, { backgroundColor: colors.surface }]}>
                            <MaterialCommunityIcons name="check-circle-outline" size={32} color={colors.textTertiary} />
                            <Text style={[theme.typography.body, { color: colors.textSecondary, marginTop: 8 }]}>
                                {medicines.length === 0 ? 'No medicines added yet. Scan a prescription to start!' : 'All doses completed for today!'}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Upcoming Doses */}
                {(() => {
                    const now = new Date();
                    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                    const upcomingDoses = [];
                    for (const med of medicines) {
                        const schedules = (med.schedule && med.schedule.length > 0)
                            ? med.schedule
                            : getDefaultSchedules(med.frequency, med.instruction);
                        for (const time of schedules) {
                            if (time >= currentTime) {
                                const [h, m] = time.split(':').map(Number);
                                const target = new Date();
                                target.setHours(h, m, 0, 0);
                                const diff = target - now;
                                const hLeft = Math.floor(diff / 3600000);
                                const mLeft = Math.floor((diff % 3600000) / 60000);
                                const countdown = hLeft > 0 ? `${hLeft}h ${mLeft}m` : `${mLeft} min`;
                                const hDisplay = h % 12 || 12;
                                const ampm = h >= 12 ? 'PM' : 'AM';
                                upcomingDoses.push({
                                    medicine: med.name, dosage: med.dosage, time,
                                    timeIST: `${hDisplay}:${String(m).padStart(2, '0')} ${ampm} IST`,
                                    countdown, color: med.color || '#4CAF50', id: `${med.id}-${time}`,
                                });
                            }
                        }
                    }
                    upcomingDoses.sort((a, b) => a.time.localeCompare(b.time));

                    if (upcomingDoses.length > 0) {
                        return (
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <Text style={[theme.typography.h3, { color: colors.text }]}>Upcoming Doses</Text>
                                    <Text style={[theme.typography.bodySmall, { color: colors.primary, fontWeight: '600' }]}>{upcomingDoses.length} remaining</Text>
                                </View>
                                {upcomingDoses.map((dose, i) => (
                                    <View key={dose.id || i} style={[styles.doseItem, { backgroundColor: colors.surface }, theme.shadows.small]}>
                                        <View style={[styles.doseTime, { backgroundColor: colors.accent, minWidth: 110 }]}>
                                            <MaterialCommunityIcons name="clock-outline" size={14} color={colors.primary} />
                                            <Text style={[theme.typography.bodySmall, { color: colors.primary, fontWeight: '700', marginLeft: 4 }]}>{dose.timeIST}</Text>
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={[theme.typography.body, { color: colors.text, fontWeight: '600' }]} numberOfLines={1}>{dose.medicine}</Text>
                                            <Text style={[theme.typography.caption, { color: colors.textSecondary }]}>{dose.dosage}</Text>
                                        </View>
                                        <View style={[styles.countdownBadge, { backgroundColor: colors.primary + '15' }]}>
                                            <Text style={[theme.typography.caption, { color: colors.primary, fontWeight: '700' }]}>{dose.countdown}</Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        );
                    }
                    return null;
                })()}

                {/* My Medicines */}
                {medicines.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={[theme.typography.h3, { color: colors.text }]}>My Medicines</Text>
                            <Text style={[theme.typography.bodySmall, { color: colors.primary, fontWeight: '600' }]}>{medicines.length} active</Text>
                        </View>
                        {medicines.map((med) => (
                            <View key={med.id} style={[styles.medItem, { backgroundColor: colors.surface }, theme.shadows.small]}>
                                <View style={[styles.medIcon, { backgroundColor: (med.color || '#4CAF50') + '20' }]}>
                                    <MaterialCommunityIcons name="pill" size={18} color={med.color || '#4CAF50'} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[theme.typography.body, { color: colors.text, fontWeight: '600' }]}>{med.name}</Text>
                                    <Text style={[theme.typography.caption, { color: colors.textSecondary }]}>
                                        {med.dosage} • {med.frequency || 'Once daily'} • {(() => {
                                            const scheds = (med.schedule && med.schedule.length > 0)
                                                ? med.schedule
                                                : getDefaultSchedules(med.frequency, med.instruction);
                                            return scheds.map(t => formatTimeIST(t)).join(', ');
                                        })()}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => handleDeleteMedicine(med)}
                                    style={{ padding: 8, marginLeft: 4 }}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.error || '#F44336'} />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>

            <AIFloatingMenu
                onVoicePress={() => navigation.navigate('VoiceAgent')}
                onChatPress={() => navigation.navigate('RagChat')}
            />

            {/* Medicine Alarm Modal */}
            <MedicineAlarm
                visible={alarmVisible}
                medicine={alarmMedicine}
                onDismiss={handleAlarmDismiss}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, marginBottom: 20 },
    notificationBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    riskCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginHorizontal: 20, marginBottom: 14 },
    riskHeader: { flexDirection: 'row', alignItems: 'center' },
    adherenceCard: { borderRadius: 20, padding: 24, marginHorizontal: 20, alignItems: 'center', marginBottom: 16 },
    progressContainer: { marginBottom: 20 },
    statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', width: '100%' },
    statItem: { alignItems: 'center' },
    statValueRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    statDivider: { width: 1, height: 30 },
    quickActions: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 20 },
    actionCard: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center' },
    actionIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    section: { paddingHorizontal: 20, marginBottom: 20 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    nextDoseCard: { borderRadius: 20, padding: 16 },
    nextDoseInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    nextDoseIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    emptyNextDose: { borderRadius: 16, padding: 24, alignItems: 'center' },
    medItem: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, marginBottom: 8 },
    medIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    doseItem: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, marginBottom: 8 },
    doseTime: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    doseDot: { width: 10, height: 10, borderRadius: 5 },
    countdownBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
});

export default DashboardScreen;
