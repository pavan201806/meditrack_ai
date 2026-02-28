import React, { useState, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform, Dimensions, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';

const { height } = Dimensions.get('window');

const AIFloatingMenu = ({ onVoicePress, onChatPress }) => {
    const { theme } = useTheme();
    const colors = theme.colors;
    const insets = useSafeAreaInsets();

    const [isOpen, setIsOpen] = useState(false);
    const animation = useRef(new Animated.Value(0)).current;

    const toggleMenu = () => {
        const toValue = isOpen ? 0 : 1;
        Animated.spring(animation, {
            toValue,
            friction: 6,
            tension: 40,
            useNativeDriver: true,
        }).start();
        setIsOpen(!isOpen);
    };

    const voiceTranslateY = animation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -120], // Move up 120px
    });

    const chatTranslateY = animation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -60], // Move up 60px
    });

    const rotation = animation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '45deg'], // Rotate icon to an 'X'
    });

    const opacity = animation.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, 0, 1], // Fade in options
    });

    return (
        <View style={[styles.container, { bottom: height * 0.15, right: 20 + insets.right }]}>
            {/* Voice AI Option */}
            <Animated.View style={[
                styles.optionContainer,
                { transform: [{ translateY: voiceTranslateY }], opacity }
            ]}>
                <View style={[styles.label, { backgroundColor: colors.surface }, theme.shadows.small]}>
                    <Text style={[theme.typography.caption, { color: colors.text, fontWeight: '600' }]}>Voice AI</Text>
                </View>
                <TouchableOpacity
                    style={[styles.smallButton, { backgroundColor: colors.primary }, theme.shadows.medium]}
                    onPress={() => { toggleMenu(); onVoicePress(); }}
                    activeOpacity={0.8}
                >
                    <MaterialCommunityIcons name="microphone" size={20} color="#FFF" />
                </TouchableOpacity>
            </Animated.View>

            {/* Chat AI Option */}
            <Animated.View style={[
                styles.optionContainer,
                { transform: [{ translateY: chatTranslateY }], opacity }
            ]}>
                <View style={[styles.label, { backgroundColor: colors.surface }, theme.shadows.small]}>
                    <Text style={[theme.typography.caption, { color: colors.text, fontWeight: '600' }]}>Chat AI</Text>
                </View>
                <TouchableOpacity
                    style={[styles.smallButton, { backgroundColor: '#FF9800' }, theme.shadows.medium]}
                    onPress={() => { toggleMenu(); onChatPress(); }}
                    activeOpacity={0.8}
                >
                    <MaterialCommunityIcons name="robot" size={20} color="#FFF" />
                </TouchableOpacity>
            </Animated.View>

            {/* Main Toggle Button */}
            <TouchableOpacity
                style={[styles.mainButton, { backgroundColor: colors.primary }, theme.shadows.medium]}
                onPress={toggleMenu}
                activeOpacity={0.9}
            >
                <Animated.View style={{ transform: [{ rotate: rotation }] }}>
                    <MaterialCommunityIcons name="creation" size={30} color="#FFF" />
                </Animated.View>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        alignItems: 'center',
        zIndex: 9999,
    },
    mainButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
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
    optionContainer: {
        position: 'absolute',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        width: 140, // Enough width to hold label and button
        right: 0,
    },
    smallButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 12, // Space between label and button
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
            },
            android: {
                elevation: 6,
            },
        }),
    },
    label: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 3,
            },
            android: {
                elevation: 4,
            },
        }),
    }
});

export default AIFloatingMenu;
