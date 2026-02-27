import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Animated, TextInput,
    Dimensions, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../theme/ThemeContext';
import ActionButton from '../../components/ActionButton';
import { scannerAPI, getToken } from '../../services/api';

const { width } = Dimensions.get('window');
const FRAME_SIZE = width * 0.75;

const ScannerScreen = ({ navigation }) => {
    const { theme } = useTheme();
    const colors = theme.colors;
    const insets = useSafeAreaInsets();

    const scanLineAnim = useRef(new Animated.Value(0)).current;
    const [scanned, setScanned] = useState(false);
    const [medicines, setMedicines] = useState([]);
    const [loading, setLoading] = useState(false);
    const [confirmLoading, setConfirmLoading] = useState(false);

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(scanLineAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
                Animated.timing(scanLineAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, []);

    const openCamera = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Needed', 'Camera permission is required to scan prescriptions.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            base64: true,
            allowsEditing: false,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const base64 = result.assets[0].base64;
            await scanImage(base64);
        }
    };

    const openGallery = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Needed', 'Gallery permission is required.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            base64: true,
            allowsEditing: false,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const base64 = result.assets[0].base64;
            await scanImage(base64);
        }
    };

    const scanImage = async (base64) => {
        setLoading(true);
        try {
            const res = await scannerAPI.scan(base64);
            if (res.data?.medicines?.length > 0) {
                setMedicines(res.data.medicines);
                setScanned(true);
            } else {
                Alert.alert(
                    'No Medicines Found',
                    res.data?.message || 'Could not detect medicines from this image. Would you like to add them manually?',
                    [
                        { text: 'Try Again', style: 'cancel' },
                        { text: 'Add Manually', onPress: () => addBlankMedicine() },
                    ]
                );
            }
        } catch (err) {
            Alert.alert(
                'Scan Failed',
                'Could not process the image. Would you like to add medicines manually?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Add Manually', onPress: () => addBlankMedicine() },
                ]
            );
        } finally {
            setLoading(false);
        }
    };

    // Generate default schedule times from frequency
    const getDefaultTimes = (frequency, timing) => {
        const freq = (frequency || '').toLowerCase();
        const t = (timing || '').toLowerCase();
        let times;
        if (freq.includes('twice')) times = ['08:00 AM', '08:00 PM'];
        else if (freq.includes('three')) times = ['08:00 AM', '02:00 PM', '08:00 PM'];
        else if (freq.includes('four')) times = ['08:00 AM', '12:00 PM', '04:00 PM', '08:00 PM'];
        else times = ['08:00 AM'];

        if (t.includes('before food')) {
            times = times.map(tt => tt.replace('08:00', '07:30').replace('02:00', '01:30').replace('12:00', '11:30').replace('04:00', '03:30'));
        } else if (t.includes('after food')) {
            times = times.map(tt => tt.replace('08:00', '08:30').replace('02:00', '02:30').replace('12:00', '12:30').replace('04:00', '04:30'));
        }
        return times;
    };

    const addBlankMedicine = () => {
        const defaultTimes = getDefaultTimes('Once daily', 'After food');
        setMedicines([{
            name: '', dosage: '', type: 'Oral Tablet',
            frequency: 'Once daily', duration: '7 days',
            timing: 'After food', quantity: '30 Tabs',
            confidence: { overall: 1.0 },
            scheduleTimes: defaultTimes,
        }]);
        setScanned(true);
    };

    const addAnotherMedicine = () => {
        const defaultTimes = getDefaultTimes('Once daily', 'After food');
        setMedicines(prev => [...prev, {
            name: '', dosage: '', type: 'Oral Tablet',
            frequency: 'Once daily', duration: '7 days',
            timing: 'After food', quantity: '30 Tabs',
            confidence: { overall: 1.0 },
            scheduleTimes: defaultTimes,
        }]);
    };

    const handleDemoScan = async () => {
        setLoading(true);
        try {
            const res = await scannerAPI.scan(null);
            if (res.data?.medicines?.length > 0) {
                // Add default schedule times to each scanned medicine
                const medsWithTimes = res.data.medicines.map(m => ({
                    ...m,
                    scheduleTimes: getDefaultTimes(m.frequency, m.timing),
                }));
                setMedicines(medsWithTimes);
                setScanned(true);
            } else {
                // No results — offer manual add
                addBlankMedicine();
            }
        } catch (err) {
            Alert.alert('Error', 'Could not connect to server. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    const updateMedicineField = (index, field, value) => {
        setMedicines(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            // Auto-update schedule times when frequency or timing changes
            if (field === 'frequency' || field === 'timing') {
                const freq = field === 'frequency' ? value : updated[index].frequency;
                const timing = field === 'timing' ? value : updated[index].timing;
                updated[index].scheduleTimes = getDefaultTimes(freq, timing);
            }
            return updated;
        });
    };

    // Update a specific schedule time for a medicine
    const updateScheduleTime = (medIndex, timeIndex, value) => {
        setMedicines(prev => {
            const updated = [...prev];
            const times = [...(updated[medIndex].scheduleTimes || ['08:00 AM'])];
            times[timeIndex] = value;
            updated[medIndex] = { ...updated[medIndex], scheduleTimes: times };
            return updated;
        });
    };

    const removeMedicine = (index) => {
        setMedicines(prev => prev.filter((_, i) => i !== index));
        if (medicines.length <= 1) {
            setScanned(false);
            setMedicines([]);
        }
    };

    const handleConfirmAll = async () => {
        if (medicines.length === 0) return;
        setConfirmLoading(true);
        try {
            const payload = {
                medicines: medicines.map(m => {
                    // Convert AM/PM times to 24h for backend
                    const schedules24 = (m.scheduleTimes || ['08:00 AM']).map(t => {
                        const match = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
                        if (!match) return '08:00';
                        let h = parseInt(match[1]);
                        const mins = match[2];
                        const ampm = match[3].toUpperCase();
                        if (ampm === 'PM' && h !== 12) h += 12;
                        if (ampm === 'AM' && h === 12) h = 0;
                        return `${String(h).padStart(2, '0')}:${mins}`;
                    });
                    return {
                        name: m.name, dosage: m.dosage, type: m.type || 'Oral Tablet',
                        frequency: m.frequency || 'Once daily', timing: m.timing,
                        quantity: m.quantity || '30 Tabs', schedules: schedules24,
                    };
                })
            };

            // Use batch confirm API
            const res = await scannerAPI.confirmBatch(payload.medicines);
            if (res.success) {
                Alert.alert('Success', `${res.data?.count || medicines.length} medicines added!`, [
                    { text: 'OK', onPress: () => navigation.goBack() },
                ]);
                return;
            }
        } catch (e) {
            // Fall back to individual confirm
            try {
                for (const med of medicines) {
                    const schedules24 = (med.scheduleTimes || ['08:00 AM']).map(t => {
                        const match = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
                        if (!match) return '08:00';
                        let h = parseInt(match[1]);
                        const mins = match[2];
                        const ampm = match[3].toUpperCase();
                        if (ampm === 'PM' && h !== 12) h += 12;
                        if (ampm === 'AM' && h === 12) h = 0;
                        return `${String(h).padStart(2, '0')}:${mins}`;
                    });
                    await scannerAPI.confirm({
                        name: med.name, dosage: med.dosage, type: med.type,
                        frequency: med.frequency, timing: med.timing,
                        quantity: med.quantity, schedules: schedules24,
                    });
                }
                Alert.alert('Success', `${medicines.length} medicines added!`, [
                    { text: 'OK', onPress: () => navigation.goBack() },
                ]);
            } catch (err2) {
                Alert.alert('Error', err2.message || 'Failed to add medicines');
            }
        } finally {
            setConfirmLoading(false);
        }
    };

    const scanLineY = scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, FRAME_SIZE - 4] });

    const getConfidenceColor = (val) => val >= 0.8 ? '#4CAF50' : val >= 0.6 ? '#FF9800' : '#F44336';

    // ─── Scan View ──────────────────────────────────────────────
    if (!scanned) {
        return (
            <View style={[styles.container, { backgroundColor: '#000' }]}>
                <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={[theme.typography.h3, { color: '#fff' }]}>Scan Prescription</Text>
                    <View style={{ width: 40 }} />
                </View>

                <View style={styles.cameraArea}>
                    <View style={styles.frameContainer}>
                        <View style={[styles.corner, styles.cornerTL, { borderColor: colors.primary }]} />
                        <View style={[styles.corner, styles.cornerTR, { borderColor: colors.primary }]} />
                        <View style={[styles.corner, styles.cornerBL, { borderColor: colors.primary }]} />
                        <View style={[styles.corner, styles.cornerBR, { borderColor: colors.primary }]} />
                        <Animated.View style={[styles.scanLine, { backgroundColor: colors.primary, transform: [{ translateY: scanLineY }] }]} />
                        <MaterialCommunityIcons name="camera" size={60} color="rgba(255,255,255,0.3)" />
                        <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 12, fontSize: 14 }}>Tap below to capture prescription</Text>
                    </View>

                    {loading ? (
                        <View style={{ marginTop: 30, alignItems: 'center' }}>
                            <ActivityIndicator color={colors.primary} size="large" />
                            <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 10 }}>Analyzing prescription...</Text>
                        </View>
                    ) : (
                        <View style={styles.buttonRow}>
                            <TouchableOpacity
                                style={[styles.scanButton, { backgroundColor: colors.primary }]}
                                onPress={openCamera} activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons name="camera" size={24} color="#fff" />
                                <Text style={{ color: '#fff', fontSize: 12, marginTop: 4, fontWeight: '600' }}>Camera</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.scanButton, { backgroundColor: '#FF9800' }]}
                                onPress={openGallery} activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons name="image" size={24} color="#fff" />
                                <Text style={{ color: '#fff', fontSize: 12, marginTop: 4, fontWeight: '600' }}>Gallery</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.scanButton, { backgroundColor: '#4CAF50' }]}
                                onPress={addBlankMedicine} activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons name="pencil-plus" size={24} color="#fff" />
                                <Text style={{ color: '#fff', fontSize: 12, marginTop: 4, fontWeight: '600' }}>Manual</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <Text style={{ color: 'rgba(255,255,255,0.4)', marginTop: 16, fontSize: 12 }}>
                        Scan a prescription or add medicines manually
                    </Text>
                </View>
            </View>
        );
    }

    // ─── Results View — Editable Medicine Cards ─────────────────
    return (
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.background }]}>
                <TouchableOpacity onPress={() => { setScanned(false); setMedicines([]); }} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[theme.typography.h3, { color: colors.text }]}>
                    {medicines.length} Medicine{medicines.length !== 1 ? 's' : ''} Found
                </Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
                {/* AI badge */}
                <View style={[styles.aiBadge, { backgroundColor: colors.accent }]}>
                    <MaterialCommunityIcons name="auto-fix" size={16} color={colors.primary} />
                    <Text style={[theme.typography.bodySmall, { color: colors.primary, marginLeft: 6, fontWeight: '600' }]}>
                        AI Extracted — Tap any field to correct
                    </Text>
                </View>

                {medicines.map((med, index) => {
                    const conf = med.confidence?.overall || 0.85;
                    return (
                        <View key={index} style={[styles.medCard, { backgroundColor: colors.surface }, theme.shadows.small]}>
                            {/* Card header */}
                            <View style={styles.cardHeader}>
                                <View style={[styles.cardNum, { backgroundColor: colors.primary }]}>
                                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{index + 1}</Text>
                                </View>
                                <View style={[styles.confBadge, { backgroundColor: getConfidenceColor(conf) + '20' }]}>
                                    <Text style={{ color: getConfidenceColor(conf), fontSize: 11, fontWeight: '600' }}>
                                        {Math.round(conf * 100)}% match
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => removeMedicine(index)} style={{ marginLeft: 'auto' }}>
                                    <MaterialCommunityIcons name="close-circle" size={22} color={colors.error} />
                                </TouchableOpacity>
                            </View>

                            {/* Editable fields */}
                            <EditField label="Medicine Name" value={med.name} icon="pill"
                                onChange={(v) => updateMedicineField(index, 'name', v)} colors={colors} theme={theme} />
                            <View style={styles.fieldRow}>
                                <EditField label="Dosage" value={med.dosage} icon="flask" half
                                    onChange={(v) => updateMedicineField(index, 'dosage', v)} colors={colors} theme={theme} />
                                <EditField label="Type" value={med.type} icon="package-variant" half
                                    onChange={(v) => updateMedicineField(index, 'type', v)} colors={colors} theme={theme} />
                            </View>
                            <View style={styles.fieldRow}>
                                <EditField label="Frequency" value={med.frequency} icon="refresh" half
                                    onChange={(v) => updateMedicineField(index, 'frequency', v)} colors={colors} theme={theme} />
                                <EditField label="Duration" value={med.duration || '7 days'} icon="calendar-range" half
                                    onChange={(v) => updateMedicineField(index, 'duration', v)} colors={colors} theme={theme} />
                            </View>
                            <View style={styles.fieldRow}>
                                <EditField label="Timing" value={med.timing || 'After food'} icon="clock-outline" half
                                    onChange={(v) => updateMedicineField(index, 'timing', v)} colors={colors} theme={theme} />
                                <EditField label="Quantity" value={med.quantity} icon="numeric" half
                                    onChange={(v) => updateMedicineField(index, 'quantity', v)} colors={colors} theme={theme} />
                            </View>

                            {/* Schedule Times */}
                            <View style={{ marginTop: 10, padding: 12, backgroundColor: colors.accent, borderRadius: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <MaterialCommunityIcons name="alarm" size={16} color={colors.primary} />
                                    <Text style={[theme.typography.bodySmall, { color: colors.primary, fontWeight: '700', marginLeft: 6 }]}>
                                        Reminder Times — Set your times below
                                    </Text>
                                </View>
                                {(med.scheduleTimes || ['08:00 AM']).map((time, tIdx) => (
                                    <View key={tIdx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                        <MaterialCommunityIcons name="clock-outline" size={16} color={colors.primary} />
                                        <Text style={[theme.typography.caption, { color: colors.textSecondary, marginLeft: 6, width: 50 }]}>
                                            Dose {tIdx + 1}:
                                        </Text>
                                        <TextInput
                                            value={time}
                                            onChangeText={(v) => updateScheduleTime(index, tIdx, v)}
                                            style={{
                                                flex: 1, backgroundColor: colors.surface, borderRadius: 8,
                                                paddingHorizontal: 12, paddingVertical: 6, marginLeft: 6,
                                                fontSize: 14, fontWeight: '700', color: colors.text,
                                                borderWidth: 1, borderColor: colors.primary + '40',
                                            }}
                                            placeholder="08:00 AM"
                                            placeholderTextColor={colors.textTertiary}
                                        />
                                    </View>
                                ))}
                            </View>
                        </View>
                    );
                })}

                {/* Add another medicine button */}
                <TouchableOpacity
                    onPress={addAnotherMedicine}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary + '60', marginBottom: 10 }}
                    activeOpacity={0.7}
                >
                    <MaterialCommunityIcons name="plus-circle-outline" size={20} color={colors.primary} />
                    <Text style={[theme.typography.body, { color: colors.primary, marginLeft: 8, fontWeight: '600' }]}>Add Another Medicine</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Bottom actions */}
            <View style={[styles.bottomBar, { backgroundColor: colors.background, paddingBottom: insets.bottom + 10 }]}>
                <ActionButton title="Scan Again" variant="outline" onPress={() => { setScanned(false); setMedicines([]); }} style={{ flex: 1, marginRight: 8 }} />
                <ActionButton title={`Add ${medicines.length} Medicine${medicines.length !== 1 ? 's' : ''}`} variant="dark" onPress={handleConfirmAll} loading={confirmLoading} style={{ flex: 1.4, marginLeft: 8 }} />
            </View>
        </KeyboardAvoidingView>
    );
};

// ─── Editable Field Component ───────────────────────────────────
const EditField = ({ label, value, icon, onChange, colors, theme, half }) => (
    <View style={[editStyles.wrapper, half && { flex: 1 }]}>
        <Text style={[theme.typography.caption, { color: colors.textTertiary, marginBottom: 4 }]}>{label}</Text>
        <View style={[editStyles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <MaterialCommunityIcons name={icon} size={14} color={colors.textTertiary} />
            <TextInput
                style={[editStyles.input, theme.typography.bodySmall, { color: colors.text }]}
                value={value} onChangeText={onChange}
                placeholderTextColor={colors.textTertiary}
            />
        </View>
    </View>
);

const editStyles = StyleSheet.create({
    wrapper: { marginBottom: 8 },
    inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, height: 38, gap: 6 },
    input: { flex: 1, height: '100%', fontSize: 13 },
});

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 },
    backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    cameraArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    frameContainer: { width: FRAME_SIZE, height: FRAME_SIZE, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    corner: { position: 'absolute', width: 30, height: 30 },
    cornerTL: { top: 0, left: 0, borderLeftWidth: 3, borderTopWidth: 3 },
    cornerTR: { top: 0, right: 0, borderRightWidth: 3, borderTopWidth: 3 },
    cornerBL: { bottom: 0, left: 0, borderLeftWidth: 3, borderBottomWidth: 3 },
    cornerBR: { bottom: 0, right: 0, borderRightWidth: 3, borderBottomWidth: 3 },
    scanLine: { position: 'absolute', left: 0, right: 0, height: 2, opacity: 0.8 },
    buttonRow: { flexDirection: 'row', marginTop: 30, gap: 16 },
    scanButton: { width: 80, height: 80, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    aiBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginBottom: 14 },
    medCard: { borderRadius: 16, padding: 16, marginBottom: 14 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    cardNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    confBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    fieldRow: { flexDirection: 'row', gap: 10 },
    bottomBar: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#eee' },
});

export default ScannerScreen;
