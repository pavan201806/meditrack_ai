import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

const DrugInteractionAlert = ({ interactions, onDismiss }) => {
    const { theme } = useTheme();
    const colors = theme.colors;

    if (!interactions || interactions.length === 0) return null;

    const hasSevere = interactions.some(i => i.severity === 'severe');

    const getSeverityStyle = (severity) => {
        switch (severity) {
            case 'severe': return { bg: '#FFEBEE', color: '#D32F2F', icon: 'alert-octagon' };
            case 'moderate': return { bg: '#FFF3E0', color: '#F57C00', icon: 'alert' };
            default: return { bg: '#FFF8E1', color: '#FFA000', icon: 'information' };
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: hasSevere ? '#FFEBEE' : '#FFF3E0', borderColor: hasSevere ? '#EF9A9A' : '#FFE0B2' }]}>
            <View style={styles.header}>
                <MaterialCommunityIcons name={hasSevere ? 'alert-octagon' : 'alert'} size={20} color={hasSevere ? '#D32F2F' : '#F57C00'} />
                <Text style={[theme.typography.h4, { color: hasSevere ? '#D32F2F' : '#F57C00', marginLeft: 8, flex: 1 }]}>
                    Drug Interaction{interactions.length > 1 ? 's' : ''} Detected
                </Text>
                {onDismiss && (
                    <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <MaterialCommunityIcons name="close" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                )}
            </View>

            {interactions.map((interaction, idx) => {
                const s = getSeverityStyle(interaction.severity);
                return (
                    <View key={idx} style={[styles.interactionItem, { backgroundColor: s.bg }]}>
                        <View style={styles.drugPair}>
                            <Text style={[theme.typography.bodySmall, { color: s.color, fontWeight: '700' }]}>
                                {interaction.drug_a} ↔ {interaction.drug_b}
                            </Text>
                            <View style={[styles.severityBadge, { backgroundColor: s.color }]}>
                                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>{interaction.severity}</Text>
                            </View>
                        </View>
                        <Text style={[theme.typography.caption, { color: s.color, marginTop: 4 }]}>{interaction.description}</Text>
                    </View>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { borderRadius: 14, borderWidth: 1, padding: 14, marginHorizontal: 20, marginBottom: 14 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    interactionItem: { borderRadius: 10, padding: 10, marginBottom: 6 },
    drugPair: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    severityBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
});

export default DrugInteractionAlert;
