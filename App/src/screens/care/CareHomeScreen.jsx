import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';

const CareHomeScreen = ({ navigation }) => {
    const { theme } = useTheme();
    const colors = theme.colors;
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
            <View style={styles.header}>
                <Text style={[theme.typography.h1, { color: colors.text }]}>Care Hub</Text>
                <Text style={[theme.typography.body, { color: colors.textSecondary }]}>Find specialized doctors and order medicines.</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                {/* Doctors Card */}
                <TouchableOpacity
                    style={[styles.card, { backgroundColor: colors.surface }, theme.shadows.medium]}
                    onPress={() => navigation.navigate('FindDoctors')}
                    activeOpacity={0.8}
                >
                    <View style={styles.cardContent}>
                        <View style={[styles.iconBox, { backgroundColor: '#E3F2FD' }]}>
                            <MaterialCommunityIcons name="stethoscope" size={36} color="#2196F3" />
                        </View>
                        <View style={styles.textContainer}>
                            <Text style={[theme.typography.h3, { color: colors.text }]}>Find Doctors</Text>
                            <Text style={[theme.typography.bodySmall, { color: colors.textSecondary, marginTop: 4 }]}>
                                Book consultations with top specialists near you.
                            </Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textTertiary} />
                    </View>
                </TouchableOpacity>

                {/* Medicines Card */}
                <TouchableOpacity
                    style={[styles.card, { backgroundColor: colors.surface }, theme.shadows.medium]}
                    onPress={() => navigation.navigate('FindMedications')}
                    activeOpacity={0.8}
                >
                    <View style={styles.cardContent}>
                        <View style={[styles.iconBox, { backgroundColor: '#E8F5E9' }]}>
                            <MaterialCommunityIcons name="medical-bag" size={36} color="#4CAF50" />
                        </View>
                        <View style={styles.textContainer}>
                            <Text style={[theme.typography.h3, { color: colors.text }]}>Order Medicines</Text>
                            <Text style={[theme.typography.bodySmall, { color: colors.textSecondary, marginTop: 4 }]}>
                                Guaranteed authentic meds delivered to your door.
                            </Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textTertiary} />
                    </View>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    scroll: {
        paddingHorizontal: 20,
        paddingBottom: 100,
    },
    card: {
        borderRadius: 20,
        marginBottom: 16,
        padding: 20,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconBox: {
        width: 64,
        height: 64,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textContainer: {
        flex: 1,
        marginLeft: 16,
        marginRight: 8,
    }
});

export default CareHomeScreen;
