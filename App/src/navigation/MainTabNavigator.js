import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';

import DashboardScreen from '../screens/home/DashboardScreen';
import RemindersScreen from '../screens/reminders/RemindersScreen';
import AnalyticsScreen from '../screens/analytics/AnalyticsScreen';
import CaretakerScreen from '../screens/caretaker/CaretakerScreen';
import CareHomeScreen from '../screens/care/CareHomeScreen';

const Tab = createBottomTabNavigator();

const TAB_CONFIG = [
    { icon: 'home', iconOutline: 'home-outline', label: 'Home' },
    { icon: 'bell', iconOutline: 'bell-outline', label: 'Reminders' },
    { icon: 'medical-bag', iconOutline: 'medical-bag', label: 'Care' },
    { icon: 'chart-bar', iconOutline: 'chart-bar', label: 'Analytics' },
    { icon: 'account', iconOutline: 'account-outline', label: 'Profile' },
];

const CustomTabBar = ({ state, descriptors, navigation }) => {
    const { theme } = useTheme();
    const colors = theme.colors;
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.tabBar, { backgroundColor: colors.tabBar, paddingBottom: insets.bottom || 8 }, theme.shadows.large]}>
            {state.routes.map((route, index) => {
                const tab = TAB_CONFIG[index];
                if (!tab) return null;
                const isFocused = state.index === index;

                const onPress = () => {
                    const event = navigation.emit({
                        type: 'tabPress',
                        target: route.key,
                        canPreventDefault: true,
                    });
                    if (!isFocused && !event.defaultPrevented) {
                        navigation.navigate(route.name);
                    }
                };

                return (
                    <TouchableOpacity
                        key={route.key}
                        onPress={onPress}
                        activeOpacity={0.7}
                        style={styles.tabItem}
                    >
                        <MaterialCommunityIcons
                            name={isFocused ? tab.icon : tab.iconOutline}
                            size={24}
                            color={isFocused ? colors.tabBarActive : colors.tabBarInactive}
                        />
                        <View
                            style={[
                                styles.tabIndicator,
                                { backgroundColor: isFocused ? colors.tabBarActive : 'transparent' },
                            ]}
                        />
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const MainTabNavigator = () => {
    return (
        <Tab.Navigator
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={{ headerShown: false }}
        >
            <Tab.Screen name="Home" component={DashboardScreen} />
            <Tab.Screen name="Reminders" component={RemindersScreen} />
            <Tab.Screen name="Care" component={CareHomeScreen} />
            <Tab.Screen name="Analytics" component={AnalyticsScreen} />
            <Tab.Screen name="Profile" component={CaretakerScreen} />
        </Tab.Navigator>
    );
};

const styles = StyleSheet.create({
    tabBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingTop: 8,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    tabItem: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        flex: 1,
    },
    tabIndicator: {
        width: 4,
        height: 4,
        borderRadius: 2,
        marginTop: 4,
    },
});

export default MainTabNavigator;
