import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

export const DoctorCard = ({ doctor, onBook }) => {
    const { theme } = useTheme();
    const colors = theme.colors;

    return (
        <View style={[styles.card, { backgroundColor: colors.surface }, theme.shadows.small]}>
            <View style={styles.cardHeader}>
                <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[theme.typography.h3, { color: colors.primary }]}>{doctor.name.charAt(0)}</Text>
                </View>
                <View style={styles.info}>
                    <Text style={[theme.typography.h4, { color: colors.text }]}>{doctor.name}</Text>
                    <Text style={[theme.typography.bodySmall, { color: colors.primary, fontWeight: '600' }]}>{doctor.specialization}</Text>
                    <View style={styles.subInfoRow}>
                        <MaterialCommunityIcons name="star" size={14} color="#FF9800" />
                        <Text style={[theme.typography.caption, { color: colors.textSecondary, marginLeft: 2 }]}>{doctor.rating} ({doctor.reviews} reviews)</Text>
                        <Text style={[theme.typography.caption, { color: colors.textTertiary, marginHorizontal: 6 }]}>•</Text>
                        <Text style={[theme.typography.caption, { color: colors.textSecondary }]}>{doctor.experience} exp</Text>
                    </View>
                </View>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.footer}>
                <View>
                    <Text style={[theme.typography.caption, { color: colors.textTertiary }]}>Consultation Fee</Text>
                    <Text style={[theme.typography.body, { color: colors.text, fontWeight: '700' }]}>₹{doctor.fee}</Text>
                </View>
                <TouchableOpacity
                    style={[styles.bookBtn, { backgroundColor: colors.primary }]}
                    onPress={() => onBook(doctor)}
                    activeOpacity={0.8}
                >
                    <Text style={[theme.typography.bodySmall, { color: '#FFF', fontWeight: '600' }]}>Book Appointment</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

export const ShopMedicineCard = ({ medicine, onOrder }) => {
    const { theme } = useTheme();
    const colors = theme.colors;

    return (
        <View style={[styles.card, { backgroundColor: colors.surface }, theme.shadows.small]}>
            <View style={styles.medHeader}>
                <View style={[styles.medIconBox, { backgroundColor: '#4CAF5020' }]}>
                    <MaterialCommunityIcons name="pill" size={24} color="#4CAF50" />
                </View>
                <View style={styles.medInfo}>
                    <Text style={[theme.typography.h4, { color: colors.text }]} numberOfLines={1}>{medicine.name}</Text>
                    <Text style={[theme.typography.caption, { color: colors.textSecondary }]} numberOfLines={2}>{medicine.uses}</Text>
                </View>
                <View style={styles.priceTag}>
                    <Text style={[theme.typography.body, { color: colors.text, fontWeight: '700' }]}>₹{medicine.price}</Text>
                </View>
            </View>
            <View style={styles.availabilityRow}>
                <MaterialCommunityIcons
                    name={medicine.inStock ? "check-circle" : "close-circle"}
                    size={14}
                    color={medicine.inStock ? "#4CAF50" : "#F44336"}
                />
                <Text style={[theme.typography.caption, {
                    color: medicine.inStock ? "#4CAF50" : "#F44336",
                    marginLeft: 4,
                    fontWeight: '600'
                }]}>
                    {medicine.inStock ? "In Stock" : "Out of Stock"}
                </Text>
            </View>
            <TouchableOpacity
                style={[
                    styles.orderBtn,
                    {
                        backgroundColor: medicine.inStock ? colors.primary : colors.surface,
                        borderColor: medicine.inStock ? colors.primary : colors.border,
                        borderWidth: medicine.inStock ? 0 : 1
                    }
                ]}
                onPress={() => medicine.inStock && onOrder(medicine)}
                activeOpacity={0.8}
                disabled={!medicine.inStock}
            >
                <Text style={[theme.typography.bodySmall, {
                    color: medicine.inStock ? '#FFF' : colors.textTertiary,
                    fontWeight: '600'
                }]}>
                    {medicine.inStock ? "Order Now" : "Unavailable"}
                </Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        marginHorizontal: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
    },
    info: {
        flex: 1,
        marginLeft: 12,
    },
    subInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    divider: {
        height: 1,
        marginVertical: 12,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    bookBtn: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    medHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    medIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    medInfo: {
        flex: 1,
        marginLeft: 12,
        marginRight: 8,
    },
    priceTag: {
        alignItems: 'flex-end',
    },
    availabilityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 16,
    },
    orderBtn: {
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    }
});
