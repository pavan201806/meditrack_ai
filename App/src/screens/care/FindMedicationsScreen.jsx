import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { ShopMedicineCard } from '../../components/CareComponents';

const MOCK_MEDICINES = [
    { id: 'm1', name: 'Paracetamol 500mg', uses: 'Fever and Mild Pain Relief', price: 45, inStock: true },
    { id: 'm2', name: 'Amoxicillin 250mg', uses: 'Bacterial Infections', price: 120, inStock: true },
    { id: 'm3', name: 'Ibuprofen 400mg', uses: 'Inflammation and Pain', price: 60, inStock: false },
    { id: 'm4', name: 'Cetirizine 10mg', uses: 'Allergy Relief', price: 35, inStock: true },
    { id: 'm5', name: 'Atorvastatin 20mg', uses: 'Cholesterol Management', price: 210, inStock: true },
];

const FindMedicationsScreen = ({ navigation }) => {
    const { theme } = useTheme();
    const colors = theme.colors;
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState('');

    const filteredMedicines = MOCK_MEDICINES.filter(med =>
        med.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        med.uses.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleOrder = (medicine) => {
        // Pass item to checkout as a medicine order
        navigation.navigate('Checkout', { item: medicine, type: 'medicine' });
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={28} color={colors.text} />
                </TouchableOpacity>
                <Text style={[theme.typography.h3, { color: colors.text, flex: 1, textAlign: 'center', marginRight: 40 }]}>
                    Order Medicines
                </Text>
            </View>

            <View style={styles.searchContainer}>
                <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
                    <MaterialCommunityIcons name="magnify" size={20} color={colors.textTertiary} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search medicines by name or use..."
                        placeholderTextColor={colors.textTertiary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                {filteredMedicines.map(med => (
                    <ShopMedicineCard key={med.id} medicine={med} onOrder={handleOrder} />
                ))}
                {filteredMedicines.length === 0 && (
                    <Text style={[theme.typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: 40 }]}>
                        No medicines found matching "{searchQuery}"
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

export default FindMedicationsScreen;
