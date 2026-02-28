import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';

const CheckoutScreen = ({ route, navigation }) => {
    const { item, type } = route.params;
    const { theme } = useTheme();
    const colors = theme.colors;
    const insets = useSafeAreaInsets();

    const [processing, setProcessing] = useState(false);
    const [success, setSuccess] = useState(false);

    // Platform Revenue Model (10% commission + flat service fee)
    const basePrice = type === 'doctor' ? item.fee : item.price;
    const commisionRate = 0.10;
    const platformFee = basePrice * commisionRate;
    const serviceFee = 15;
    const totalAmount = basePrice + platformFee + serviceFee;

    const handlePayment = () => {
        setProcessing(true);
        // Simulate network payment request hitting our backend logic
        setTimeout(() => {
            setProcessing(false);
            setSuccess(true);
        }, 2000);
    };

    if (success) {
        return (
            <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
                <MaterialCommunityIcons name="check-circle" size={80} color="#4CAF50" />
                <Text style={[theme.typography.h2, { color: colors.text, marginTop: 24, textAlign: 'center' }]}>
                    {type === 'doctor' ? 'Appointment Confirmed!' : 'Order Placed!'}
                </Text>
                <Text style={[theme.typography.body, { color: colors.textSecondary, marginTop: 12, textAlign: 'center', paddingHorizontal: 40 }]}>
                    {type === 'doctor'
                        ? `Your consultation with ${item.name} is booked.`
                        : `Your order for ${item.name} is confirmed and will be delivered shortly.`}
                </Text>
                <TouchableOpacity
                    style={[styles.doneBtn, { backgroundColor: colors.primary }]}
                    onPress={() => navigation.navigate('CareHome')}
                >
                    <Text style={[theme.typography.body, { color: '#FFF', fontWeight: '700' }]}>Return to Care Hub</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} disabled={processing}>
                    <MaterialCommunityIcons name="arrow-left" size={28} color={colors.text} />
                </TouchableOpacity>
                <Text style={[theme.typography.h3, { color: colors.text, flex: 1, textAlign: 'center', marginRight: 40 }]}>
                    Checkout Summary
                </Text>
            </View>

            <View style={styles.content}>
                <View style={[styles.receiptCard, { backgroundColor: colors.surface }, theme.shadows.medium]}>
                    <Text style={[theme.typography.h3, { color: colors.text, marginBottom: 16 }]}>
                        {type === 'doctor' ? 'Consultation Request' : 'Pharmacy Order'}
                    </Text>

                    <View style={styles.itemRow}>
                        <Text style={[theme.typography.body, { color: colors.textSecondary }]}>{item.name}</Text>
                        <Text style={[theme.typography.body, { color: colors.text }]}>₹{basePrice.toFixed(2)}</Text>
                    </View>

                    {/* Exposing the mock revenue model directly for the prompt requirement */}
                    <View style={styles.itemRow}>
                        <Text style={[theme.typography.bodySmall, { color: colors.textTertiary }]}>Platform Commission (10%)</Text>
                        <Text style={[theme.typography.bodySmall, { color: colors.textTertiary }]}>₹{platformFee.toFixed(2)}</Text>
                    </View>

                    <View style={styles.itemRow}>
                        <Text style={[theme.typography.bodySmall, { color: colors.textTertiary }]}>Service Tax & Fees</Text>
                        <Text style={[theme.typography.bodySmall, { color: colors.textTertiary }]}>₹{serviceFee.toFixed(2)}</Text>
                    </View>

                    <View style={[styles.divider, { backgroundColor: colors.border }]} />

                    <View style={styles.itemRow}>
                        <Text style={[theme.typography.h4, { color: colors.text }]}>Total Amount</Text>
                        <Text style={[theme.typography.h3, { color: colors.primary }]}>₹{totalAmount.toFixed(2)}</Text>
                    </View>
                </View>

                {processing ? (
                    <View style={styles.processingBlock}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={[theme.typography.body, { color: colors.textSecondary, marginTop: 16 }]}>Processing Payment...</Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={[styles.payBtn, { backgroundColor: colors.primary }, theme.shadows.large]}
                        onPress={handlePayment}
                        activeOpacity={0.8}
                    >
                        <MaterialCommunityIcons name="lock" size={18} color="#FFF" style={{ marginRight: 8 }} />
                        <Text style={[theme.typography.h4, { color: '#FFF' }]}>Pay ₹{totalAmount.toFixed(2)}</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 10,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    receiptCard: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 40,
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    divider: {
        height: 1,
        marginVertical: 16,
    },
    payBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
    },
    processingBlock: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
    },
    doneBtn: {
        marginTop: 40,
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 12,
    }
});

export default CheckoutScreen;
