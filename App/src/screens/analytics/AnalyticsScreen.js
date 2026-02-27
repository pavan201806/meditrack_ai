import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Circle as SvgCircle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import { analyticsAPI } from '../../services/api';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 80;
const CHART_HEIGHT = 140;

const AnalyticsScreen = ({ navigation }) => {
    const { theme } = useTheme();
    const colors = theme.colors;
    const insets = useSafeAreaInsets();
    const [data, setData] = useState({
        currentStreak: 0, totalDoses: 0, adherencePercentage: 0,
        taken: 0, missed: 0,
        weeklyAdherence: [{ day: 'Mon', value: 0 }, { day: 'Tue', value: 0 }, { day: 'Wed', value: 0 }, { day: 'Thu', value: 0 }, { day: 'Fri', value: 0 }, { day: 'Sat', value: 0 }, { day: 'Sun', value: 0 }],
        medicationBreakdown: [],
    });
    const [aiInsight, setAiInsight] = useState('Add medicines and log doses to see AI-powered insights about your health patterns.');
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            fetchAnalytics();
        }, [])
    );

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const [statsRes, insightRes] = await Promise.all([
                analyticsAPI.get(7),
                analyticsAPI.insights().catch(() => null),
            ]);
            if (statsRes.data) {
                setData(prev => ({
                    ...prev,
                    currentStreak: statsRes.data.currentStreak ?? 0,
                    totalDoses: statsRes.data.total ?? statsRes.data.totalDoses ?? 0,
                    adherencePercentage: statsRes.data.adherencePercentage ?? 0,
                    taken: statsRes.data.taken ?? 0,
                    missed: statsRes.data.missed ?? 0,
                    weeklyAdherence: statsRes.data.weeklyAdherence?.length > 0
                        ? statsRes.data.weeklyAdherence : prev.weeklyAdherence,
                    medicationBreakdown: statsRes.data.medicationBreakdown?.length > 0
                        ? statsRes.data.medicationBreakdown : prev.medicationBreakdown,
                }));
            }
            if (insightRes?.data?.aiInsight) {
                setAiInsight(insightRes.data.aiInsight);
            }
        } catch (err) {
            // Keep default empty state
        } finally {
            setLoading(false);
        }
    };

    // Generate SVG path for chart
    const chartData = data.weeklyAdherence;
    const maxValue = Math.max(100, ...chartData.map(i => i.value || 0)) || 100;
    const points = chartData.map((item, index) => ({
        x: chartData.length > 1 ? (index / (chartData.length - 1)) * CHART_WIDTH : CHART_WIDTH / 2,
        y: CHART_HEIGHT - ((item.value || 0) / maxValue) * CHART_HEIGHT,
    }));

    const createSmoothPath = (pts) => {
        if (!pts || pts.length < 2) return `M 0 ${CHART_HEIGHT} L ${CHART_WIDTH} ${CHART_HEIGHT}`;
        // Validate points — no NaN
        const valid = pts.every(p => isFinite(p.x) && isFinite(p.y));
        if (!valid) return `M 0 ${CHART_HEIGHT} L ${CHART_WIDTH} ${CHART_HEIGHT}`;
        let path = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const cp1x = pts[i].x + (pts[i + 1].x - pts[i].x) / 3;
            const cp1y = pts[i].y;
            const cp2x = pts[i + 1].x - (pts[i + 1].x - pts[i].x) / 3;
            const cp2y = pts[i + 1].y;
            path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${pts[i + 1].x} ${pts[i + 1].y}`;
        }
        return path;
    };

    const linePath = createSmoothPath(points);
    const areaPath = linePath ? `${linePath} L ${CHART_WIDTH} ${CHART_HEIGHT} L 0 ${CHART_HEIGHT} Z` : '';

    const missedPct = data.totalDoses > 0 ? Math.round((data.missed / data.totalDoses) * 100) : 0;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Header title="AI Analytics" showBack onBackPress={() => navigation.goBack()} rightIcon="calendar" />

            <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 80 }} showsVerticalScrollIndicator={false}>
                {loading && <ActivityIndicator style={{ marginVertical: 10 }} color={colors.primary} />}

                {/* Top Stats */}
                <View style={styles.topStats}>
                    <View style={{ flex: 1 }}>
                        <Text style={[theme.typography.caption, { color: colors.primary }]}>Current Streak</Text>
                        <View style={styles.statValueRow}>
                            <Text style={[theme.typography.number, { color: colors.text }]}>{data.currentStreak}</Text>
                            <Text style={[theme.typography.body, { color: colors.textSecondary, marginLeft: 4 }]}>days</Text>
                        </View>
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Text style={[theme.typography.caption, { color: colors.primary }]}>Total Doses</Text>
                        <View style={styles.statValueRow}>
                            <Text style={[theme.typography.number, { color: colors.text }]}>{data.totalDoses}</Text>
                            <Text style={[theme.typography.body, { color: colors.primary, marginLeft: 8, fontWeight: '600' }]}>{data.adherencePercentage}%</Text>
                        </View>
                    </View>
                </View>

                {/* AI Insights */}
                <View style={[styles.insightCard, { backgroundColor: colors.surface }, theme.shadows.small]}>
                    <View style={styles.insightHeader}>
                        <MaterialCommunityIcons name="auto-fix" size={18} color={colors.primary} />
                        <Text style={[theme.typography.h4, { color: colors.text, marginLeft: 6 }]}>AI Insights</Text>
                    </View>
                    <Text style={[theme.typography.body, { color: colors.textSecondary, marginTop: 8, lineHeight: 22 }]}>
                        {aiInsight}
                    </Text>
                </View>

                {/* Weekly Adherence Chart */}
                <View style={[styles.chartCard, { backgroundColor: colors.surface }, theme.shadows.small]}>
                    <View style={styles.chartHeader}>
                        <View>
                            <Text style={[theme.typography.h3, { color: colors.text }]}>Weekly Adherence</Text>
                            <Text style={[theme.typography.bodySmall, { color: colors.textSecondary }]}>Last 7 Days</Text>
                        </View>
                        <View style={[styles.trendBadge, { backgroundColor: colors.accent }]}>
                            <MaterialCommunityIcons name="trending-up" size={14} color={colors.primary} />
                            <Text style={[theme.typography.bodySmall, { color: colors.primary, fontWeight: '600', marginLeft: 2 }]}>+5%</Text>
                        </View>
                    </View>

                    <View style={styles.chartContainer}>
                        <Svg width={CHART_WIDTH} height={CHART_HEIGHT + 10}>
                            <Defs>
                                <SvgGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                    <Stop offset="0" stopColor={colors.primary} stopOpacity="0.3" />
                                    <Stop offset="1" stopColor={colors.primary} stopOpacity="0.02" />
                                </SvgGradient>
                            </Defs>
                            <Path d={areaPath} fill="url(#areaGradient)" />
                            <Path d={linePath} fill="none" stroke={colors.primary} strokeWidth={2.5} />
                            {points.map((point, index) => (
                                <SvgCircle key={index} cx={point.x} cy={point.y} r={4} fill={colors.surface} stroke={colors.primary} strokeWidth={2} />
                            ))}
                        </Svg>
                    </View>

                    <View style={styles.chartLabels}>
                        {chartData.map((item, index) => (
                            <Text key={index} style={[theme.typography.caption, { color: colors.textSecondary }]}>{item.day}</Text>
                        ))}
                    </View>
                </View>

                {/* Taken / Missed */}
                <View style={styles.summaryRow}>
                    <View style={[styles.summaryCard, { backgroundColor: colors.surface }, theme.shadows.small]}>
                        <MaterialCommunityIcons name="check-circle" size={22} color={colors.primary} />
                        <Text style={[theme.typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>Taken</Text>
                        <Text style={[theme.typography.number, { color: colors.text }]}>{data.taken}</Text>
                        <View style={[styles.progressBar, { backgroundColor: colors.accent }]}>
                            <View style={[styles.progressFill, { backgroundColor: colors.primary, width: '100%' }]} />
                        </View>
                    </View>
                    <View style={[styles.summaryCard, { backgroundColor: colors.surface }, theme.shadows.small]}>
                        <MaterialCommunityIcons name="alert-circle" size={22} color={colors.error} />
                        <Text style={[theme.typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>Missed</Text>
                        <Text style={[theme.typography.number, { color: colors.text }]}>{data.missed}</Text>
                        <View style={[styles.progressBar, { backgroundColor: colors.errorLight }]}>
                            <View style={[styles.progressFill, { backgroundColor: colors.error, width: `${missedPct}%` }]} />
                        </View>
                    </View>
                </View>

                {/* Medication Breakdown */}
                <View style={[styles.breakdownCard, { backgroundColor: colors.surface }, theme.shadows.small]}>
                    <Text style={[theme.typography.h3, { color: colors.text, marginBottom: 14 }]}>Medication Breakdown</Text>
                    {data.medicationBreakdown.map((med, index) => (
                        <View key={index}>
                            <View style={styles.breakdownItem}>
                                <View style={styles.breakdownLeft}>
                                    <View style={[styles.medDot, { backgroundColor: med.color }]} />
                                    <Text style={[theme.typography.body, { color: colors.text }]}>{med.name}</Text>
                                </View>
                                <Text style={[theme.typography.body, { color: colors.primary, fontWeight: '600' }]}>{med.adherence}%</Text>
                            </View>
                            <View style={[styles.breakdownBar, { backgroundColor: colors.accent }]}>
                                <View style={[styles.breakdownBarFill, { backgroundColor: med.color, width: `${med.adherence}%` }]} />
                            </View>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    topStats: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 16 },
    statValueRow: { flexDirection: 'row', alignItems: 'baseline' },
    insightCard: { borderRadius: 16, padding: 16, marginHorizontal: 20, marginBottom: 12 },
    insightHeader: { flexDirection: 'row', alignItems: 'center' },
    chartCard: { borderRadius: 16, padding: 16, marginHorizontal: 20, marginBottom: 12 },
    chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    trendBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    chartContainer: { alignItems: 'center', paddingHorizontal: 10 },
    chartLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 4 },
    summaryRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 12 },
    summaryCard: { flex: 1, borderRadius: 16, padding: 16 },
    progressBar: { height: 4, borderRadius: 2, marginTop: 8 },
    progressFill: { height: '100%', borderRadius: 2 },
    breakdownCard: { borderRadius: 16, padding: 16, marginHorizontal: 20 },
    breakdownItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    breakdownLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    medDot: { width: 10, height: 10, borderRadius: 5 },
    breakdownBar: { height: 4, borderRadius: 2, marginBottom: 6 },
    breakdownBarFill: { height: '100%', borderRadius: 2 },
});

export default AnalyticsScreen;
