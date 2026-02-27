import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import { medicinesAPI, dosesAPI } from '../../services/api';

const MedicineDetailScreen = ({ route, navigation }) => {
    const { theme } = useTheme();
    const colors = theme.colors;
    const insets = useSafeAreaInsets();
    const medicineId = route?.params?.medicineId;

    const [medicine, setMedicine] = useState(null);
    const [taken, setTaken] = useState(false);
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            fetchMedicine();
        }, [medicineId])
    );

    const fetchMedicine = async () => {
        setLoading(true);
        try {
            if (medicineId) {
                const res = await medicinesAPI.get(medicineId);
                if (res.data) {
                    setMedicine(res.data);
                    return;
                }
            }
        } catch (err) {
            Alert.alert('Error', 'Could not load medicine details.');
        }
        setLoading(false);
    };

    const handleToggleTaken = async (val) => {
        setTaken(val);
        if (medicine && val) {
            try {
                await dosesAPI.log(medicine.id, medicine.schedule?.[0] || '08:00', 'taken');
            } catch (err) {
                console.log('Dose log failed:', err.message);
            }
        }
    };

    if (loading && !medicine) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!medicine) return null;

    const handleDelete = () => {
        Alert.alert(
            'Delete Medicine',
            `Are you sure you want to delete "${medicine.name}"? This will remove all associated schedules and reminders.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await medicinesAPI.delete(medicine.id);
                            Alert.alert('Deleted', `${medicine.name} has been removed.`);
                            navigation.goBack();
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
            <Header title="Medicine Details" showBack onBackPress={() => navigation.goBack()} rightIcon="pencil" />

            <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
                {/* Medicine Header */}
                <View style={[styles.medHeader, { backgroundColor: colors.surface }, theme.shadows.small]}>
                    <View style={[styles.medIcon, { backgroundColor: (medicine.color || colors.primary) + '20' }]}>
                        <MaterialCommunityIcons name={medicine.icon || 'pill'} size={32} color={medicine.color || colors.primary} />
                    </View>
                    <Text style={[theme.typography.h2, { color: colors.text, marginTop: 12 }]}>{medicine.name}</Text>
                    <Text style={[theme.typography.body, { color: colors.textSecondary }]}>
                        {medicine.dosage} • {medicine.type}
                    </Text>
                </View>

                {/* Mark as Taken */}
                <View style={[styles.takenCard, { backgroundColor: colors.surface }, theme.shadows.small]}>
                    <View style={styles.takenLeft}>
                        <MaterialCommunityIcons name={taken ? 'check-circle' : 'circle-outline'} size={22} color={taken ? colors.primary : colors.textTertiary} />
                        <Text style={[theme.typography.h4, { color: colors.text, marginLeft: 10 }]}>Mark as Taken</Text>
                    </View>
                    <Switch value={taken} onValueChange={handleToggleTaken} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
                </View>

                {/* Details */}
                <View style={[styles.detailsCard, { backgroundColor: colors.surface }, theme.shadows.small]}>
                    <DetailRow icon="flask" label="Dosage" value={medicine.dosage} colors={colors} theme={theme} />
                    <DetailRow icon="package-variant" label="Quantity" value={medicine.quantity} colors={colors} theme={theme} />
                    <DetailRow icon="refresh" label="Frequency" value={medicine.frequency} colors={colors} theme={theme} />
                    <DetailRow icon="food-apple" label="Instruction" value={medicine.instruction} colors={colors} theme={theme} />
                </View>

                {/* Schedule */}
                <View style={[styles.scheduleCard, { backgroundColor: colors.surface }, theme.shadows.small]}>
                    <Text style={[theme.typography.h3, { color: colors.text, marginBottom: 12 }]}>Schedule</Text>
                    <View style={styles.scheduleRow}>
                        {(medicine.schedule || ['08:00']).map((time, i) => {
                            const [h, m] = time.split(':').map(Number);
                            const hD = h % 12 || 12;
                            const ap = h >= 12 ? 'PM' : 'AM';
                            const displayTime = `${hD}:${String(m).padStart(2, '0')} ${ap} IST`;
                            return (
                                <View key={i} style={[styles.timeBadge, { backgroundColor: colors.accent }]}>
                                    <MaterialCommunityIcons name="clock-outline" size={14} color={colors.primary} />
                                    <Text style={[theme.typography.bodySmall, { color: colors.primary, fontWeight: '600', marginLeft: 4 }]}>{displayTime}</Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* Notes */}
                {medicine.notes && (
                    <View style={[styles.notesCard, { backgroundColor: colors.surface }, theme.shadows.small]}>
                        <Text style={[theme.typography.h3, { color: colors.text, marginBottom: 8 }]}>Notes</Text>
                        <Text style={[theme.typography.body, { color: colors.textSecondary, lineHeight: 22 }]}>{medicine.notes}</Text>
                    </View>
                )}

                {/* Delete Button */}
                <TouchableOpacity
                    style={[styles.deleteButton, { backgroundColor: colors.error + '15', borderColor: colors.error + '40' }]}
                    onPress={handleDelete}
                    activeOpacity={0.7}
                >
                    <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.error} />
                    <Text style={[theme.typography.body, { color: colors.error, fontWeight: '600', marginLeft: 8 }]}>
                        Delete Medicine
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
};

const DetailRow = ({ icon, label, value, colors, theme }) => (
    <View style={detailStyles.row}>
        <View style={detailStyles.left}>
            <MaterialCommunityIcons name={icon} size={18} color={colors.textTertiary} />
            <Text style={[theme.typography.body, { color: colors.textSecondary, marginLeft: 10 }]}>{label}</Text>
        </View>
        <Text style={[theme.typography.body, { color: colors.text, fontWeight: '600' }]}>{value || '-'}</Text>
    </View>
);

const detailStyles = StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
    left: { flexDirection: 'row', alignItems: 'center' },
});

const styles = StyleSheet.create({
    container: { flex: 1 },
    medHeader: { borderRadius: 20, padding: 24, marginHorizontal: 20, alignItems: 'center', marginBottom: 12 },
    medIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    takenCard: { borderRadius: 16, padding: 16, marginHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    takenLeft: { flexDirection: 'row', alignItems: 'center' },
    detailsCard: { borderRadius: 16, padding: 16, marginHorizontal: 20, marginBottom: 12 },
    scheduleCard: { borderRadius: 16, padding: 16, marginHorizontal: 20, marginBottom: 12 },
    scheduleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    timeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
    notesCard: { borderRadius: 16, padding: 16, marginHorizontal: 20 },
    deleteButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        borderRadius: 16, padding: 16, marginHorizontal: 20, marginTop: 16, borderWidth: 1,
    },
});

export default MedicineDetailScreen;
