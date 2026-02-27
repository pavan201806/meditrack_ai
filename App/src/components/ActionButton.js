import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';

const ActionButton = ({
    title,
    onPress,
    variant = 'primary',
    icon,
    loading = false,
    disabled = false,
    style,
    textStyle,
    fullWidth = false,
}) => {
    const { theme } = useTheme();
    const colors = theme.colors;

    const getButtonStyles = () => {
        switch (variant) {
            case 'primary':
                return {
                    backgroundColor: colors.primary,
                    textColor: '#FFFFFF',
                };
            case 'secondary':
                return {
                    backgroundColor: colors.accent,
                    textColor: colors.primary,
                };
            case 'outline':
                return {
                    backgroundColor: 'transparent',
                    textColor: colors.text,
                    borderColor: colors.border,
                    borderWidth: 1.5,
                };
            case 'dark':
                return {
                    backgroundColor: colors.cardDark,
                    textColor: '#FFFFFF',
                };
            default:
                return {
                    backgroundColor: colors.primary,
                    textColor: '#FFFFFF',
                };
        }
    };

    const buttonStyle = getButtonStyles();

    if (variant === 'primary') {
        return (
            <TouchableOpacity
                onPress={onPress}
                disabled={disabled || loading}
                activeOpacity={0.8}
                style={[fullWidth && styles.fullWidth, style]}
            >
                <LinearGradient
                    colors={[colors.primary, colors.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                        styles.button,
                        fullWidth && styles.fullWidth,
                        disabled && styles.disabled,
                    ]}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                        <>
                            {icon}
                            <Text style={[styles.text, theme.typography.button, { color: '#FFFFFF' }, textStyle]}>
                                {title}
                            </Text>
                        </>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.8}
            style={[
                styles.button,
                {
                    backgroundColor: buttonStyle.backgroundColor,
                    borderColor: buttonStyle.borderColor,
                    borderWidth: buttonStyle.borderWidth || 0,
                },
                fullWidth && styles.fullWidth,
                disabled && styles.disabled,
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator color={buttonStyle.textColor} size="small" />
            ) : (
                <>
                    {icon}
                    <Text style={[styles.text, theme.typography.button, { color: buttonStyle.textColor }, textStyle]}>
                        {title}
                    </Text>
                </>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 16,
        gap: 8,
    },
    fullWidth: {
        width: '100%',
    },
    text: {
        textAlign: 'center',
    },
    disabled: {
        opacity: 0.5,
    },
});

export default ActionButton;
