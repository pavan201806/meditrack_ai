import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated } from 'react-native';
import PagerView from 'react-native-pager-view';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import ActionButton from '../../components/ActionButton';
import { onboardingData } from '../../data/mockData';

const { width, height } = Dimensions.get('window');

const OnboardingScreen = ({ navigation }) => {
    const { theme } = useTheme();
    const colors = theme.colors;
    const insets = useSafeAreaInsets();
    const [currentPage, setCurrentPage] = useState(0);
    const pagerRef = useRef(null);
    const fadeAnim = useRef(new Animated.Value(1)).current;

    const handlePageChange = (e) => {
        setCurrentPage(e.nativeEvent.position);
    };

    const handleNext = () => {
        if (currentPage < onboardingData.length - 1) {
            pagerRef.current?.setPage(currentPage + 1);
        } else {
            navigation.replace('Auth');
        }
    };

    const handleSkip = () => {
        navigation.replace('Auth');
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <PagerView
                ref={pagerRef}
                style={styles.pagerView}
                initialPage={0}
                onPageSelected={handlePageChange}
            >
                {onboardingData.map((item, index) => (
                    <View key={item.id} style={styles.page}>
                        <LinearGradient
                            colors={item.gradient}
                            style={styles.illustrationContainer}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <View style={styles.iconCircle}>
                                <MaterialCommunityIcons
                                    name={item.icon}
                                    size={64}
                                    color={colors.primaryDark}
                                />
                            </View>
                        </LinearGradient>

                        <View style={styles.textContainer}>
                            <Text style={[theme.typography.h1, { color: colors.text, textAlign: 'center' }]}>
                                {item.title}
                            </Text>
                            <Text
                                style={[
                                    theme.typography.body,
                                    { color: colors.textSecondary, textAlign: 'center', marginTop: 12, paddingHorizontal: 20 },
                                ]}
                            >
                                {item.description}
                            </Text>
                        </View>
                    </View>
                ))}
            </PagerView>

            <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 20 }]}>
                {/* Page Indicators */}
                <View style={styles.indicators}>
                    {onboardingData.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.indicator,
                                {
                                    backgroundColor: index === currentPage ? colors.primary : colors.border,
                                    width: index === currentPage ? 24 : 8,
                                },
                            ]}
                        />
                    ))}
                </View>

                <View style={styles.buttonsRow}>
                    {currentPage < onboardingData.length - 1 && (
                        <Text
                            onPress={handleSkip}
                            style={[theme.typography.body, { color: colors.textSecondary }]}
                        >
                            Skip
                        </Text>
                    )}
                    <View style={{ flex: 1 }} />
                    <ActionButton
                        title={currentPage === onboardingData.length - 1 ? 'Get Started' : 'Next'}
                        onPress={handleNext}
                        variant="primary"
                        style={{ paddingHorizontal: 32 }}
                    />
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    pagerView: {
        flex: 1,
    },
    page: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    illustrationContainer: {
        width: width * 0.65,
        height: width * 0.65,
        borderRadius: width * 0.325,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 40,
    },
    iconCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(255,255,255,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    textContainer: {
        alignItems: 'center',
    },
    bottomContainer: {
        paddingHorizontal: 24,
    },
    indicators: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        marginBottom: 24,
    },
    indicator: {
        height: 8,
        borderRadius: 4,
    },
    buttonsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
});

export default OnboardingScreen;
