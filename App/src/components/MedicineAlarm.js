import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated, Vibration } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeContext';

const RING_DURATION = 3000;    // 30 seconds ring
const SNOOZE_DURATION = 30000; // 2 minutes snooze
const MAX_CYCLES = 2;           // 3 cycles before auto-SMS

let AudioModule = null;
try { AudioModule = require('expo-audio'); } catch (e) { }

const MedicineAlarm = ({ visible, medicine, onDismiss }) => {
    const { theme } = useTheme();
    const colors = theme.colors;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const speakIntervalRef = useRef(null);
    const autoSnoozeTimerRef = useRef(null);
    const snoozeTimerRef = useRef(null);
    const soundRef = useRef(null);
    const cycleRef = useRef(0);
    const [currentCycle, setCurrentCycle] = useState(0);
    const [isSnoozed, setIsSnoozed] = useState(false);
    const [snoozeCountdown, setSnoozeCountdown] = useState(0);
    const snoozeCountdownRef = useRef(null);

    // Start alarm ringing
    const startRinging = async () => {
        setIsSnoozed(false);

        // Start vibration
        Vibration.vibrate([0, 500, 200, 500, 200, 500], true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

        // Play ringtone sound (try expo-audio, fallback to speech only)
        try {
            if (AudioModule) {
                if (soundRef.current) {
                    try { await soundRef.current.unloadAsync(); } catch (e) { }
                }
                const { sound } = await AudioModule.Audio.Sound.createAsync(
                    require('../../assets/alarm_ringtone.wav'),
                    { shouldPlay: true, isLooping: true, volume: 1.0 }
                );
                soundRef.current = sound;
            }
        } catch (err) {
            console.log('Ringtone fallback to speech:', err.message);
        }

        // Voice announcement
        const speakMessage = () => {
            const msg = `Time to take ${medicine.name}. ${medicine.dosage}. ${medicine.instruction || ''}`;
            Speech.speak(msg, { language: 'en-IN', pitch: 1.0, rate: 0.85 });
        };
        speakMessage();

        // Repeat voice every 15 seconds
        speakIntervalRef.current = setInterval(() => {
            speakMessage();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }, 15000);

        // Auto-snooze after 1 minute if no response
        autoSnoozeTimerRef.current = setTimeout(() => {
            autoSnooze();
        }, RING_DURATION);
    };

    // Stop all alarm sounds/vibrations
    const stopAlarm = async () => {
        Vibration.cancel();
        Speech.stop();
        if (speakIntervalRef.current) clearInterval(speakIntervalRef.current);
        if (autoSnoozeTimerRef.current) clearTimeout(autoSnoozeTimerRef.current);
        if (snoozeTimerRef.current) clearTimeout(snoozeTimerRef.current);
        if (snoozeCountdownRef.current) clearInterval(snoozeCountdownRef.current);
        if (soundRef.current) {
            try {
                await soundRef.current.stopAsync();
                await soundRef.current.unloadAsync();
            } catch (e) { }
            soundRef.current = null;
        }
    };

    // Auto-snooze: patient didn't respond in 1 minute
    const autoSnooze = async () => {
        await stopAlarm();
        cycleRef.current += 1;
        setCurrentCycle(cycleRef.current);

        if (cycleRef.current >= MAX_CYCLES) {
            // 3 cycles done, patient never responded → auto send SMS
            onDismiss('auto_sms');
            return;
        }

        // Start 5-minute snooze countdown
        setIsSnoozed(true);
        setSnoozeCountdown(SNOOZE_DURATION / 1000);

        // Countdown every second
        snoozeCountdownRef.current = setInterval(() => {
            setSnoozeCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(snoozeCountdownRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // After 5 minutes, ring again
        snoozeTimerRef.current = setTimeout(() => {
            setIsSnoozed(false);
            clearInterval(snoozeCountdownRef.current);
            startRinging();
        }, SNOOZE_DURATION);
    };

    // On visible change
    useEffect(() => {
        if (visible && medicine) {
            // Reset cycle count
            cycleRef.current = 0;
            setCurrentCycle(0);
            setIsSnoozed(false);

            // Start pulse animation
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
                ])
            );
            pulse.start();

            startRinging();

            return () => {
                pulse.stop();
                stopAlarm();
            };
        }
    }, [visible, medicine]);

    const handleTaken = async () => {
        await stopAlarm();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        cycleRef.current = 0;
        onDismiss('taken');
    };

    const handleManualSnooze = async () => {
        await stopAlarm();
        cycleRef.current += 1;
        setCurrentCycle(cycleRef.current);

        if (cycleRef.current >= MAX_CYCLES) {
            onDismiss('auto_sms');
            return;
        }

        // Start 5-min snooze
        setIsSnoozed(true);
        setSnoozeCountdown(SNOOZE_DURATION / 1000);

        snoozeCountdownRef.current = setInterval(() => {
            setSnoozeCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(snoozeCountdownRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        snoozeTimerRef.current = setTimeout(() => {
            setIsSnoozed(false);
            clearInterval(snoozeCountdownRef.current);
            startRinging();
        }, SNOOZE_DURATION);
    };

    if (!visible || !medicine) return null;

    const timeDisplay = medicine.timeIST || medicine.time || '';
    const formatCountdown = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: colors.surface }]}>
                    {/* Pulsing bell */}
                    <Animated.View style={[styles.bellCircle, { backgroundColor: colors.primary + '20', transform: [{ scale: pulseAnim }] }]}>
                        <View style={[styles.bellInner, { backgroundColor: colors.primary }]}>
                            <MaterialCommunityIcons name="bell-ring" size={48} color="#fff" />
                        </View>
                    </Animated.View>

                    <Text style={[theme.typography.h2, { color: colors.text, marginTop: 24, textAlign: 'center' }]}>
                        {isSnoozed ? '💤 Snoozed' : '🔔 Medicine Time!'}
                    </Text>

                    <Text style={[theme.typography.body, { color: colors.textSecondary, marginTop: 4, textAlign: 'center' }]}>
                        ⏰ {timeDisplay}
                    </Text>

                    {/* Cycle indicator */}
                    <View style={{ flexDirection: 'row', marginTop: 10, gap: 8 }}>
                        {[1, 2, 3].map(i => (
                            <View key={i} style={[styles.cycleDot, {
                                backgroundColor: i <= currentCycle ? '#FF9800' : i === currentCycle + 1 && !isSnoozed ? colors.primary : colors.border,
                            }]}>
                                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{i}</Text>
                            </View>
                        ))}
                    </View>
                    <Text style={[theme.typography.caption, { color: colors.textTertiary, marginTop: 4 }]}>
                        Attempt {Math.min(currentCycle + 1, MAX_CYCLES)} of {MAX_CYCLES}
                    </Text>

                    {/* Snooze countdown */}
                    {isSnoozed && (
                        <View style={[styles.snoozeInfo, { backgroundColor: '#FF9800' + '15' }]}>
                            <MaterialCommunityIcons name="alarm-snooze" size={20} color="#FF9800" />
                            <Text style={[theme.typography.h3, { color: '#FF9800', marginLeft: 8 }]}>
                                {formatCountdown(snoozeCountdown)}
                            </Text>
                            <Text style={[theme.typography.caption, { color: '#FF9800', marginLeft: 8 }]}>
                                Next alarm in
                            </Text>
                        </View>
                    )}

                    {/* Medicine info */}
                    <View style={[styles.medInfo, { backgroundColor: colors.accent }]}>
                        <View style={[styles.medIconCircle, { backgroundColor: colors.primary + '20' }]}>
                            <MaterialCommunityIcons name="pill" size={28} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 14 }}>
                            <Text style={[theme.typography.h3, { color: colors.text }]}>{medicine.name}</Text>
                            <Text style={[theme.typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                                {medicine.dosage} • {medicine.instruction || medicine.frequency || ''}
                            </Text>
                        </View>
                    </View>

                    {/* Auto-SMS warning */}
                    {currentCycle >= 2 && !isSnoozed && (
                        <View style={[styles.warningBanner, { backgroundColor: '#FF1744' + '15' }]}>
                            <MaterialCommunityIcons name="alert" size={16} color="#FF1744" />
                            <Text style={[theme.typography.caption, { color: '#FF1744', marginLeft: 6, flex: 1 }]}>
                                Last attempt! SMS will be sent to caretaker if not taken.
                            </Text>
                        </View>
                    )}

                    {/* Buttons */}
                    <TouchableOpacity
                        style={[styles.takenBtn, { backgroundColor: colors.primary }]}
                        onPress={handleTaken}
                        activeOpacity={0.8}
                    >
                        <MaterialCommunityIcons name="check-bold" size={22} color="#fff" />
                        <Text style={[theme.typography.h4, { color: '#fff', marginLeft: 8 }]}>
                            I've Taken It ✓
                        </Text>
                    </TouchableOpacity>

                    {!isSnoozed && (
                        <TouchableOpacity
                            style={[styles.snoozeBtn, { backgroundColor: colors.surfaceVariant || '#f0f0f0' }]}
                            onPress={handleManualSnooze}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons name="alarm-snooze" size={20} color={colors.textSecondary} />
                            <Text style={[theme.typography.body, { color: colors.textSecondary, marginLeft: 8, fontWeight: '600' }]}>
                                Snooze 2 min
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center', alignItems: 'center', padding: 24,
    },
    container: {
        width: '100%', borderRadius: 28, padding: 32,
        alignItems: 'center', maxWidth: 380,
    },
    bellCircle: {
        width: 120, height: 120, borderRadius: 60,
        alignItems: 'center', justifyContent: 'center',
    },
    bellInner: {
        width: 80, height: 80, borderRadius: 40,
        alignItems: 'center', justifyContent: 'center',
    },
    cycleDot: {
        width: 24, height: 24, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
    },
    snoozeInfo: {
        flexDirection: 'row', alignItems: 'center',
        borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
        marginTop: 12,
    },
    medInfo: {
        flexDirection: 'row', alignItems: 'center',
        borderRadius: 16, padding: 16, width: '100%', marginTop: 16,
    },
    medIconCircle: {
        width: 50, height: 50, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
    },
    warningBanner: {
        flexDirection: 'row', alignItems: 'center',
        borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
        width: '100%', marginTop: 12,
    },
    takenBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        borderRadius: 16, paddingVertical: 16, width: '100%', marginTop: 20,
    },
    snoozeBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        borderRadius: 16, paddingVertical: 14, width: '100%', marginTop: 10,
    },
});

export default MedicineAlarm;
