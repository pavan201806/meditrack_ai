import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

const StatCard = ({
    title,
    value,
    subtitle,
    icon,
    iconColor,
    accentColor,
    style,
    large = false,
}) => {
    const { theme } = useTheme();
    const colors = theme.colors;

    return (
        <View style={[styles.card, { backgroundColor: colors.surface }, theme.shadows.small, style]}>
            {icon && (
                <View style={[styles.iconWrap, { backgroundColor: (iconColor || colors.primary) + '15' }]}>
                    <MaterialCommunityIcons
                        name={icon}
                        size={large ? 24 : 20}
                        color={iconColor || colors.primary}
                    />
                </View>
            )}
            <Text style={[theme.typography.caption, { color: colors.textSecondary, marginTop: icon ? 8 : 0 }]}>
                {title}
            </Text>
            <Text
                style={[
                    large ? theme.typography.number : theme.typography.numberSmall,
                    { color: colors.text, marginTop: 2 },
                ]}
            >
                {value}
            </Text>
            {subtitle && (
                <Text style={[theme.typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                    {subtitle}
                </Text>
            )}
            {accentColor && (
                <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        padding: 16,
        flex: 1,
    },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    accentBar: {
        height: 3,
        borderRadius: 2,
        marginTop: 10,
    },
});

export default StatCard;
