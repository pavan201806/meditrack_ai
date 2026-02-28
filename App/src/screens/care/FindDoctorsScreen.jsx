import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { DoctorCard } from '../../components/CareComponents';

const MOCK_DOCTORS = [
    { id: 'd1', name: 'Dr. Sarah Jenkins', specialization: 'Cardiologist', experience: '15 Yrs', rating: 4.8, reviews: 124, fee: 1200 },
    { id: 'd2', name: 'Dr. Raj Patel', specialization: 'General Physician', experience: '8 Yrs', rating: 4.6, reviews: 89, fee: 500 },
    { id: 'd3', name: 'Dr. Emily Chen', specialization: 'Neurologist', experience: '12 Yrs', rating: 4.9, reviews: 210, fee: 1500 },
    { id: 'd4', name: 'Dr. Alan Smith', specialization: 'Dentist', experience: '5 Yrs', rating: 4.5, reviews: 45, fee: 800 },
];

const FindDoctorsScreen = ({ navigation }) => {
    const { theme } = useTheme();
    const colors = theme.colors;
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState('');

    const filteredDoctors = MOCK_DOCTORS.filter(doc =>
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.specialization.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleBook = (doctor) => {
        // Pass item to checkout as a consultation booking
        navigation.navigate('Checkout', { item: doctor, type: 'doctor' });
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={28} color={colors.text} />
                </TouchableOpacity>
                <Text style={[theme.typography.h3, { color: colors.text, flex: 1, textAlign: 'center', marginRight: 40 }]}>
                    Find Doctors
                </Text>
            </View>

            <View style={styles.searchContainer}>
                <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
                    <MaterialCommunityIcons name="magnify" size={20} color={colors.textTertiary} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search doctors or specialties..."
                        placeholderTextColor={colors.textTertiary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                {filteredDoctors.map(doc => (
                    <DoctorCard key={doc.id} doctor={doc} onBook={handleBook} />
                ))}
                {filteredDoctors.length === 0 && (
                    <Text style={[theme.typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: 40 }]}>
                        No doctors found matching "{searchQuery}"
                    </Text>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
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
    searchContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        height: 48,
        borderRadius: 12,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 16,
    },
    scroll: {
        paddingVertical: 8,
        paddingBottom: 40,
    }
});

export default FindDoctorsScreen;
