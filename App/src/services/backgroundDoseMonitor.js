/**
 * Background Dose Monitor — runs like a step counter, even when app is closed.
 *
 * How it works:
 * 1. Medicine schedule is saved to AsyncStorage when medicines are loaded
 * 2. Background fetch runs periodically (every ~15 min on Android, system-managed on iOS)
 * 3. On each run, it checks: is there a dose that's overdue and not acknowledged?
 * 4. If overdue, increment miss counter in AsyncStorage
 * 5. After 3 misses, automatically send SMS to caretaker contacts (cached locally)
 * 6. Also fires a notification so the OS shows the alert
 */

import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TASK_NAME = 'MEDITRACK_DOSE_CHECK';
const SCHEDULE_KEY = 'meditrack_medicine_schedule';
const DOSE_LOG_KEY = 'meditrack_dose_log_today';
const MISS_COUNT_KEY = 'meditrack_consecutive_misses';
const LAST_CHECK_KEY = 'meditrack_last_bg_check';
const CONTACTS_CACHE_KEY = 'caretaker_contacts_cache';

// ─── Save medicine schedule to AsyncStorage ──────────────────────
export const saveMedicineSchedule = async (medicines) => {
    const schedule = [];
    for (const med of medicines) {
        const times = med.schedule || [];
        for (const time of times) {
            schedule.push({
                medicineId: med.id,
                name: med.name,
                dosage: med.dosage,
                instruction: med.instruction || '',
                time, // "08:00", "14:00", etc.
            });
        }
    }
    await AsyncStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
};

// ─── Log that a dose was taken (called from Dashboard) ───────────
export const logDoseTaken = async (medicineId, time) => {
    const today = new Date().toDateString();
    const logRaw = await AsyncStorage.getItem(DOSE_LOG_KEY);
    let log = logRaw ? JSON.parse(logRaw) : { date: today, taken: [] };

    // Reset if new day
    if (log.date !== today) {
        log = { date: today, taken: [] };
    }

    log.taken.push({ medicineId, time, at: new Date().toISOString() });
    await AsyncStorage.setItem(DOSE_LOG_KEY, JSON.stringify(log));

    // Reset miss counter when a dose is taken
    await AsyncStorage.setItem(MISS_COUNT_KEY, '0');
};

// ─── Check for missed doses (runs in background) ────────────────
const checkMissedDoses = async () => {
    try {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMin = now.getMinutes();

        // Load schedule
        const scheduleRaw = await AsyncStorage.getItem(SCHEDULE_KEY);
        if (!scheduleRaw) return BackgroundFetch.BackgroundFetchResult.NoData;
        const schedule = JSON.parse(scheduleRaw);

        // Load today's dose log
        const today = now.toDateString();
        const logRaw = await AsyncStorage.getItem(DOSE_LOG_KEY);
        let log = logRaw ? JSON.parse(logRaw) : { date: today, taken: [] };
        if (log.date !== today) {
            log = { date: today, taken: [] };
            await AsyncStorage.setItem(DOSE_LOG_KEY, JSON.stringify(log));
            await AsyncStorage.setItem(MISS_COUNT_KEY, '0');
        }

        // Find overdue doses (time has passed but not logged as taken)
        const overdueDoses = [];
        for (const dose of schedule) {
            const [h, m] = dose.time.split(':').map(Number);
            const doseMinutes = h * 60 + m;
            const currentMinutes = currentHour * 60 + currentMin;

            // Dose is overdue if current time is past dose time + 10 min buffer
            if (currentMinutes > doseMinutes + 10) {
                const taken = log.taken.find(
                    t => t.medicineId === dose.medicineId && t.time === dose.time
                );
                if (!taken) {
                    overdueDoses.push(dose);
                }
            }
        }

        if (overdueDoses.length === 0) {
            return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        // Increment miss counter
        const missCountRaw = await AsyncStorage.getItem(MISS_COUNT_KEY);
        let missCount = missCountRaw ? parseInt(missCountRaw) : 0;

        // Check if we already sent notification for this check window
        const lastCheck = await AsyncStorage.getItem(LAST_CHECK_KEY);
        const checkKey = `${today}_${currentHour}`;
        if (lastCheck === checkKey) {
            // Already checked this hour
            return BackgroundFetch.BackgroundFetchResult.NoData;
        }
        await AsyncStorage.setItem(LAST_CHECK_KEY, checkKey);

        missCount += 1;
        await AsyncStorage.setItem(MISS_COUNT_KEY, String(missCount));

        // Fire notification for missed dose
        const medNames = overdueDoses.map(d => d.name).join(', ');

        await Notifications.scheduleNotificationAsync({
            content: {
                title: missCount >= 3
                    ? `🚨 URGENT: ${overdueDoses.length} dose(s) missed!`
                    : `⚠️ Missed dose: ${medNames}`,
                body: missCount >= 3
                    ? `${medNames} — NOT TAKEN. SMS alert being sent to your caretaker now!`
                    : `You missed: ${medNames}. Please take your medicine. (Warning ${missCount}/3)`,
                sound: true,
                priority: Notifications.AndroidNotificationPriority.MAX,
                data: { type: 'missed_dose_bg', missCount },
                ...(Platform.OS === 'android' && { channelId: 'medicine-alarm' }),
            },
            trigger: null, // Immediate
        });

        // After 3 misses → auto send SMS to caretaker
        if (missCount >= 3) {
            await sendAutoSMS(overdueDoses);
            await AsyncStorage.setItem(MISS_COUNT_KEY, '0'); // Reset
        }

        return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (err) {
        console.log('Background check error:', err.message);
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
};

// ─── Auto SMS to caretaker (via Backend Twilio API) ──────────────
const sendAutoSMS = async (missedDoses) => {
    try {
        const token = await AsyncStorage.getItem('meditrack_auth_token');
        if (!token) {
            console.log('No auth token — cannot send Twilio alert');
            return;
        }

        // Import BASE_URL from api.js dynamically to avoid circular deps
        const { default: apiConfig } = await import('./api');
        // Use the same BASE_URL as the api service
        const BASE_URL = 'http://10.207.18.232:5001';

        // Call backend — Twilio sends SMS + voice call automatically
        const response = await fetch(`${BASE_URL}/api/caretaker/emergency/auto-sms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                missed_medicines: missedDoses.map(d => ({ name: d.name, dosage: d.dosage })),
                reason: 'background_auto_check',
            }),
        });

        const result = await response.json();
        console.log('✅ Backend Twilio auto-alert result:', JSON.stringify(result));
    } catch (err) {
        console.log('Auto SMS via Twilio error:', err.message);
    }
};

// ─── Register the background task ───────────────────────────────
TaskManager.defineTask(TASK_NAME, async () => {
    console.log('🔄 Background dose check running...');
    return await checkMissedDoses();
});

// ─── Start background monitoring ────────────────────────────────
export const startBackgroundDoseMonitor = async () => {
    try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
        if (isRegistered) {
            console.log('✅ Background dose monitor already running');
            return;
        }

        await BackgroundFetch.registerTaskAsync(TASK_NAME, {
            minimumInterval: 15 * 60,  // Check every 15 minutes (minimum on iOS)
            stopOnTerminate: false,     // Keep running when app is killed
            startOnBoot: true,          // Start after device reboot
        });

        console.log('✅ Background dose monitor started');
    } catch (err) {
        console.log('Failed to start background monitor:', err.message);
    }
};

// ─── Stop background monitoring ─────────────────────────────────
export const stopBackgroundDoseMonitor = async () => {
    try {
        await BackgroundFetch.unregisterTaskAsync(TASK_NAME);
        console.log('🛑 Background dose monitor stopped');
    } catch (err) {
        console.log('Failed to stop background monitor:', err.message);
    }
};

// ─── Check if running ───────────────────────────────────────────
export const isBackgroundMonitorRunning = async () => {
    return await TaskManager.isTaskRegisteredAsync(TASK_NAME);
};
