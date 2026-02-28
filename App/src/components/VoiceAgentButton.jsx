import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';

const { height } = Dimensions.get('window');

const VoiceAgentButton = ({ onPress }) => {
    const { theme } = useTheme();
    const colors = theme.colors;
    const insets = useSafeAreaInsets();

    return (
        <TouchableOpacity
            style={[
                styles.button,
                {
                    backgroundColor: colors.primary,
                    bottom: height * 0.25, // Slightly below center (25% from bottom)
                    left: 16 + insets.left // 16px margin from left edge
                }
            ]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <MaterialCommunityIcons name="microphone" size={22} color="#FFF" />
            <Text style={[theme.typography.bodySmall, styles.text]}>VOiceAI</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        position: 'absolute',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 25,
        zIndex: 9999, // High z-index to float above all content
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 6,
            },
            android: {
                elevation: 10,
            },
        }),
    },
    text: {
        color: '#FFF',
        fontWeight: '700',
        marginLeft: 8,
    },
});

export default VoiceAgentButton;
