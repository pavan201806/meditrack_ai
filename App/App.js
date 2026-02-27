import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import { requestNotificationPermissions, setupNotificationCategories } from './src/services/notificationService';
import { startBackgroundDoseMonitor } from './src/services/backgroundDoseMonitor';
import * as Notifications from 'expo-notifications';

const AppContent = () => {
  const { isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
    </>
  );
};

export default function App() {
  const responseListener = useRef();
  const notificationListener = useRef();

  useEffect(() => {
    // Request permissions + set up alarm channels
    requestNotificationPermissions();
    setupNotificationCategories();

    // Start background dose monitor (runs even when app is closed)
    startBackgroundDoseMonitor();

    // Listen for notification received in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data;
      if (data?.type === 'medicine_alarm') {
        console.log('🔔 Alarm notification received for:', data.medicineName);
      }
    });

    // Listen for notification actions (tap, Take, Snooze buttons)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(async response => {
      const data = response.notification.request.content.data;
      const actionId = response.actionIdentifier;

      if (data?.type === 'medicine_alarm' || data?.type === 'medicine_reminder') {
        if (actionId === 'TAKE_MEDICINE') {
          // User pressed "Taken" on notification
          console.log('✅ Medicine taken from notification:', data.medicineName);
          try {
            const { dosesAPI } = require('./src/services/api');
            await dosesAPI.log(data.medicineId, data.time, 'taken');
          } catch (err) {
            console.log('Dose log from notification failed:', err.message);
          }
        } else if (actionId === 'SNOOZE_MEDICINE') {
          // User pressed "Snooze" — schedule another alarm in 5 min
          console.log('💤 Snoozed from notification:', data.medicineName);
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `🔔 REMINDER — ${data.medicineName}`,
              body: `Take ${data.dosage} now! (Snoozed reminder)\n${data.instruction || ''}`,
              sound: true,
              priority: Notifications.AndroidNotificationPriority.MAX,
              data: { ...data, type: 'medicine_alarm' },
              categoryIdentifier: 'medicine_alarm',
            },
            trigger: { seconds: 120 }, // 2 min snooze
          });
        } else {
          // Default tap — opens app, alarm shows from Dashboard
          console.log('Notification tapped for:', data.medicineName);
        }
      }
    });

    return () => {
      try {
        if (responseListener.current?.remove) {
          responseListener.current.remove();
        }
        if (notificationListener.current?.remove) {
          notificationListener.current.remove();
        }
      } catch (e) {
        // Expo Go may not support this
      }
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
