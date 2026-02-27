import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

const MedicineCard = ({ medicine, onPress, onToggleTaken, compact = false }) => {
    const { theme } = useTheme();
    const colors = theme.colors;

    if (compact) {
        return (
            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.7}
                style={[styles.compactCard, { backgroundColor: colors.surface }, theme.shadows.small]}
            >
                <View style={[styles.iconContainer, { backgroundColor: medicine.color + '20' }]}>
                    <MaterialCommunityIcons
                        name={medicine.icon === 'capsule' ? 'pill' : 'pill'}
                        size={20}
                        color={medicine.color}
                    />
                </View>
                <View style={styles.compactInfo}>
                    <Text style={[theme.typography.h4, { color: colors.text }]}>{medicine.name}</Text>
                    <Text style={[theme.typography.bodySmall, { color: colors.textSecondary }]}>
                        {medicine.dosage} • {medicine.frequency}
                    </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={[styles.card, { backgroundColor: colors.surface }, theme.shadows.small]}
        >
            <View style={styles.cardHeader}>
                <View style={styles.timeRow}>
                    <MaterialCommunityIcons name="clock-outline" size={14} color={colors.primary} />
                    <Text style={[theme.typography.bodySmall, { color: colors.primary, marginLeft: 4 }]}>
                        {medicine.time}
                    </Text>
                </View>
                <View style={[styles.pillImage, { backgroundColor: medicine.color + '15' }]}>
                    <Text style={{ fontSize: 28 }}>
                        {medicine.icon === 'capsule' ? '💛' : '💊'}
                    </Text>
                </View>
            </View>

            <Text style={[theme.typography.h3, { color: colors.text, marginTop: 4 }]}>
                {medicine.name} {medicine.dosage}
            </Text>
            <View style={styles.instructionRow}>
                <MaterialCommunityIcons name="silverware-fork-knife" size={14} color={colors.textSecondary} />
                <Text style={[theme.typography.bodySmall, { color: colors.textSecondary, marginLeft: 4 }]}>
                    {medicine.pillCount} {medicine.type === 'Softgel' ? 'softgels' : 'pill'} {medicine.instruction?.toLowerCase().replace('take ', '')}
                </Text>
            </View>

            <View style={styles.cardActions}>
                <TouchableOpacity
                    onPress={onToggleTaken}
                    style={[
                        styles.takeButton,
                        medicine.taken
                            ? { backgroundColor: colors.primary }
                            : { backgroundColor: colors.accent, borderColor: colors.primary, borderWidth: 1 },
                    ]}
                    activeOpacity={0.7}
                >
                    {medicine.taken && (
                        <MaterialCommunityIcons name="check" size={16} color="#FFF" style={{ marginRight: 4 }} />
                    )}
                    <Text
                        style={[
                            theme.typography.bodySmall,
                            { color: medicine.taken ? '#FFF' : colors.primary, fontWeight: '600' },
                        ]}
                    >
                        {medicine.taken ? 'Taken' : 'Take Now'}
                    </Text>
                </TouchableOpacity>
                {!medicine.taken && (
                    <TouchableOpacity
                        style={[styles.snoozeButton, { borderColor: colors.border }]}
                        activeOpacity={0.7}
                    >
                        <Text style={[theme.typography.bodySmall, { color: colors.textSecondary, fontWeight: '600' }]}>
                            Snooze
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 3,
        borderLeftColor: '#E8F5E9',
    },
    compactCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    pillImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
    },
    instructionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    compactInfo: {
        flex: 1,
    },
    cardActions: {
        flexDirection: 'row',
        marginTop: 12,
        gap: 8,
    },
    takeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 12,
        flex: 1,
    },
    snoozeButton: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 12,
        borderWidth: 1,
    },
});

export default MedicineCard;
