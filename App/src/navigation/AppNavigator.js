import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import { useTheme } from '../theme/ThemeContext';

import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import MainTabNavigator from './MainTabNavigator';
import ScannerScreen from '../screens/scanner/ScannerScreen';
import MedicineDetailScreen from '../screens/medicine/MedicineDetailScreen';
import VoiceAgentScreen from '../screens/VoiceAgentScreen';
import RagChatScreen from '../screens/RagChatScreen';

const Stack = createStackNavigator();

const AuthStack = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false, ...TransitionPresets.SlideFromRightIOS }}>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
        </Stack.Navigator>
    );
};

const AppNavigator = () => {
    const { theme } = useTheme();

    return (
        <NavigationContainer
            theme={{
                dark: theme.isDark,
                colors: {
                    primary: theme.colors.primary,
                    background: theme.colors.background,
                    card: theme.colors.surface,
                    text: theme.colors.text,
                    border: theme.colors.border,
                    notification: theme.colors.badge,
                },
            }}
        >
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                    ...TransitionPresets.SlideFromRightIOS,
                }}
            >
                <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                <Stack.Screen name="Auth" component={AuthStack} />
                <Stack.Screen name="Main" component={MainTabNavigator} />
                <Stack.Screen
                    name="Scanner"
                    component={ScannerScreen}
                    options={{ ...TransitionPresets.ModalSlideFromBottomIOS }}
                />
                <Stack.Screen name="MedicineDetail" component={MedicineDetailScreen} />
                <Stack.Screen
                    name="VoiceAgent"
                    component={VoiceAgentScreen}
                    options={{ ...TransitionPresets.ModalPresentationIOS }}
                />
                <Stack.Screen
                    name="RagChat"
                    component={RagChatScreen}
                    options={{ ...TransitionPresets.ModalPresentationIOS }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;
