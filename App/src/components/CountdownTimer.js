import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

const CountdownTimer = ({ targetTime }) => {
    const { theme } = useTheme();
    const colors = theme.colors;
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            const diff = targetTime - now;

            if (diff <= 0) {
                clearInterval(timer);
                setTimeLeft({ days: 0, hours: 0, mins: 0, secs: 0 });
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const mins = Math.floor((diff / (1000 * 60)) % 60);
            const secs = Math.floor((diff / 1000) % 60);

            setTimeLeft({ days, hours, mins, secs });
        }, 1000);

        return () => clearInterval(timer);
    }, [targetTime]);

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.05,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const pad = (num) => num.toString().padStart(2, '0');

    const TimeBlock = ({ value, label }) => (
        <View style={styles.timeBlock}>
            <Animated.View
                style={[
                    styles.timeValue,
                    { backgroundColor: 'rgba(255,255,255,0.15)', transform: [{ scale: pulseAnim }] },
                ]}
            >
                <Text style={[theme.typography.h2, { color: '#FFFFFF' }]}>{pad(value)}</Text>
            </Animated.View>
            <Text style={[theme.typography.caption, { color: 'rgba(255,255,255,0.7)', marginTop: 4 }]}>
                {label}
            </Text>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.countdown }]}>
            <View style={styles.timerRow}>
                <TimeBlock value={timeLeft.days} label="DAYS" />
                <TimeBlock value={timeLeft.hours} label="HRS" />
                <TimeBlock value={timeLeft.mins} label="MIN" />
                <TimeBlock value={timeLeft.secs} label="SEC" />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        padding: 16,
        marginTop: 8,
    },
    timerRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    timeBlock: {
        alignItems: 'center',
    },
    timeValue: {
        width: 56,
        height: 56,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default CountdownTimer;
