import React from 'react';
import { View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

const ICON_MAP = {
    'pill': 'pill',
    'capsule': 'pill',
    'needle': 'needle',
    'spray': 'spray',
    'Oral Tablet': 'pill',
    'Capsule': 'pill',
    'Syrup': 'cup-water',
    'Injectable': 'needle',
    'Gel': 'tube',
    'Cream': 'tube',
    'Ointment': 'tube',
    'Eye/Ear Drops': 'eye-outline',
    'Inhaler': 'spray',
};

const getIconName = (icon, type) => {
    if (icon && ICON_MAP[icon]) return ICON_MAP[icon];
    if (type && ICON_MAP[type]) return ICON_MAP[type];
    return 'pill';
};

const ReminderCard = ({ reminder, onTakeNow, onSnooze }) => {
    const { theme } = useTheme();
    const colors = theme.colors;

    if (reminder.status === 'completed') {
        return (
            <View style={[styles.completedCard, { backgroundColor: colors.surface }]}>
                <View style={[styles.checkIcon, { backgroundColor: colors.accent }]}>
                    <MaterialCommunityIcons name="check" size={16} color={colors.primary} />
                </View>
                <View style={styles.completedInfo}>
                    <Text style={[theme.typography.body, { color: colors.text }]}>{reminder.medicineName}</Text>
                    <Text style={[theme.typography.bodySmall, { color: colors.textSecondary }]}>
                        Taken at {reminder.time}
                    </Text>
                </View>
            </View>
        );
    }

    const iconName = getIconName(reminder.icon, reminder.type);

    return (
        <View style={[styles.card, { backgroundColor: colors.surface, borderLeftColor: colors.primaryLight }, theme.shadows.small]}>
            <View style={styles.cardHeader}>
                <View>
                    <View style={styles.timeRow}>
                        <MaterialCommunityIcons name="clock-outline" size={14} color={colors.primary} />
                        <Text style={[theme.typography.bodySmall, { color: colors.primary, marginLeft: 4, fontWeight: '700' }]}>
                            {reminder.time}
                        </Text>
                    </View>
                    {reminder.countdown ? (
                        <Text style={[theme.typography.caption, { color: colors.textSecondary, marginTop: 2, marginLeft: 18 }]}>
                            ⏱ {reminder.countdown}
                        </Text>
                    ) : null}
                </View>
                <View style={[styles.pillEmoji, { backgroundColor: colors.accent }]}>
                    <MaterialCommunityIcons name={iconName} size={26} color={colors.primary} />
                </View>
            </View>

            <Text style={[theme.typography.h3, { color: colors.text, marginTop: 6 }]}>
                {reminder.medicineName}
            </Text>
            <View style={styles.instructionRow}>
                <MaterialCommunityIcons name="pill" size={14} color={colors.textSecondary} />
                <Text style={[theme.typography.bodySmall, { color: colors.textSecondary, marginLeft: 4 }]}>
                    {reminder.instruction}
                </Text>
            </View>

            <View style={styles.actions}>
                {reminder.isNearTime ? (
                    <TouchableOpacity
                        onPress={onTakeNow}
                        style={[styles.takeButton, { backgroundColor: colors.primary }]}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons name="check" size={16} color="#FFF" />
                        <Text style={[theme.typography.bodySmall, { color: '#FFF', fontWeight: '600', marginLeft: 4 }]}>
                            Take Now
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <View style={[styles.takeButton, { backgroundColor: colors.surfaceVariant || colors.accent }]}>
                        <MaterialCommunityIcons name="timer-sand" size={16} color={colors.textSecondary} />
                        <Text style={[theme.typography.bodySmall, { color: colors.textSecondary, fontWeight: '600', marginLeft: 4 }]}>
                            {reminder.countdown || 'Scheduled'}
                        </Text>
                    </View>
                )}
                <TouchableOpacity
                    onPress={onSnooze}
                    style={[styles.snoozeButton, { backgroundColor: colors.surfaceVariant }]}
                    activeOpacity={0.7}
                >
                    <MaterialCommunityIcons name="alarm-snooze" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

export const VoiceReminderToggle = ({ enabled, onToggle }) => {
    const { theme } = useTheme();
    const colors = theme.colors;

    return (
        <View style={[styles.toggleCard, { backgroundColor: colors.surface }, theme.shadows.small]}>
            <View style={styles.toggleLeft}>
                <MaterialCommunityIcons name="microphone-outline" size={22} color={colors.text} />
                <View style={{ marginLeft: 10 }}>
                    <Text style={[theme.typography.h4, { color: colors.text }]}>Voice Reminder</Text>
                    <Text style={[theme.typography.bodySmall, { color: colors.textSecondary }]}>
                        Announce alerts aloud via AI
                    </Text>
                </View>
            </View>
            <Switch
                value={enabled}
                onValueChange={onToggle}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={enabled ? colors.primary : '#f4f3f4'}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 3,
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
    pillEmoji: {
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
    actions: {
        flexDirection: 'row',
        marginTop: 14,
        gap: 8,
    },
    takeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
    },
    snoozeButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toggleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
    },
    toggleLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    completedCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        padding: 14,
        marginBottom: 8,
    },
    checkIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    completedInfo: {
        flex: 1,
    },
});

export default ReminderCard;
