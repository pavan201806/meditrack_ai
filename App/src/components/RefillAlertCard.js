import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

const RefillAlertCard = ({ refills, onPress }) => {
    const { theme } = useTheme();
    const colors = theme.colors;

    if (!refills || refills.length === 0) return null;

    const urgentCount = refills.filter(r => r.urgent).length;

    return (
        <TouchableOpacity
            style={[styles.container, { backgroundColor: urgentCount > 0 ? '#FFF3E0' : colors.surface, borderColor: urgentCount > 0 ? '#FFE0B2' : colors.border }]}
            onPress={onPress} activeOpacity={0.7}
        >
            <View style={[styles.iconWrap, { backgroundColor: urgentCount > 0 ? '#FF980020' : colors.accent }]}>
                <MaterialCommunityIcons name="package-variant" size={20} color={urgentCount > 0 ? '#FF9800' : colors.primary} />
            </View>
            <View style={styles.content}>
                <Text style={[theme.typography.h4, { color: colors.text }]}>
                    Refill Needed ({refills.length})
                </Text>
                <Text style={[theme.typography.caption, { color: colors.textSecondary }]}>
                    {refills.map(r => `${r.name} (${r.pills_remaining} left)`).join(', ')}
                </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row', alignItems: 'center', borderRadius: 14,
        borderWidth: 1, padding: 14, marginHorizontal: 20, marginBottom: 14,
    },
    iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    content: { flex: 1 },
});

export default RefillAlertCard;
