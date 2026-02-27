import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';

const Header = ({
    title,
    showBack = false,
    onBackPress,
    rightIcon,
    onRightPress,
    subtitle,
}) => {
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const colors = theme.colors;

    return (
        <View style={[styles.container, { paddingTop: insets.top + 8, backgroundColor: colors.background }]}>
            <View style={styles.row}>
                <View style={styles.left}>
                    {showBack ? (
                        <TouchableOpacity onPress={onBackPress} style={styles.iconButton} activeOpacity={0.7}>
                            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.iconPlaceholder} />
                    )}
                </View>

                <View style={styles.center}>
                    <Text style={[theme.typography.h3, { color: colors.text }]} numberOfLines={1}>
                        {title}
                    </Text>
                    {subtitle && (
                        <Text style={[theme.typography.bodySmall, { color: colors.textSecondary }]}>
                            {subtitle}
                        </Text>
                    )}
                </View>

                <View style={styles.right}>
                    {rightIcon ? (
                        <TouchableOpacity onPress={onRightPress} style={styles.iconButton} activeOpacity={0.7}>
                            <MaterialCommunityIcons name={rightIcon} size={24} color={colors.text} />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.iconPlaceholder} />
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    left: {
        width: 40,
        alignItems: 'flex-start',
    },
    center: {
        flex: 1,
        alignItems: 'center',
    },
    right: {
        width: 40,
        alignItems: 'flex-end',
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconPlaceholder: {
        width: 40,
        height: 40,
    },
});

export default Header;
