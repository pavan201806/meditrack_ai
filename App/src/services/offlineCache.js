/**
 * Offline Cache Service.
 * Caches medicines, reminders, dose logs in AsyncStorage.
 * Queues offline dose logs for sync when reconnected.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEYS = {
    MEDICINES: 'meditrack_cache_medicines',
    REMINDERS: 'meditrack_cache_reminders',
    DASHBOARD: 'meditrack_cache_dashboard',
    ANALYTICS: 'meditrack_cache_analytics',
    OFFLINE_QUEUE: 'meditrack_offline_queue',
};

// ─── Cache Functions ────────────────────────────────────────────

export const cacheData = async (key, data) => {
    try {
        const payload = JSON.stringify({ data, timestamp: Date.now() });
        await AsyncStorage.setItem(key, payload);
    } catch (e) {
        console.log('Cache write failed:', e);
    }
};

export const getCachedData = async (key, maxAgeMs = 30 * 60 * 1000) => {
    try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) return null;
        const { data, timestamp } = JSON.parse(raw);
        if (Date.now() - timestamp > maxAgeMs) return null; // Expired
        return data;
    } catch (e) {
        return null;
    }
};

// ─── Specific Caches ────────────────────────────────────────────

export const cacheMedicines = (data) => cacheData(CACHE_KEYS.MEDICINES, data);
export const getCachedMedicines = () => getCachedData(CACHE_KEYS.MEDICINES);

export const cacheReminders = (data) => cacheData(CACHE_KEYS.REMINDERS, data);
export const getCachedReminders = () => getCachedData(CACHE_KEYS.REMINDERS);

export const cacheDashboard = (data) => cacheData(CACHE_KEYS.DASHBOARD, data);
export const getCachedDashboard = () => getCachedData(CACHE_KEYS.DASHBOARD, 10 * 60 * 1000);

export const cacheAnalytics = (data) => cacheData(CACHE_KEYS.ANALYTICS, data);
export const getCachedAnalytics = () => getCachedData(CACHE_KEYS.ANALYTICS);

// ─── Offline Dose Queue ────────────────────────────────────────

export const queueOfflineDose = async (doseLog) => {
    try {
        const raw = await AsyncStorage.getItem(CACHE_KEYS.OFFLINE_QUEUE);
        const queue = raw ? JSON.parse(raw) : [];
        queue.push({ ...doseLog, queuedAt: Date.now() });
        await AsyncStorage.setItem(CACHE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
    } catch (e) {
        console.log('Queue write failed:', e);
    }
};

export const getOfflineQueue = async () => {
    try {
        const raw = await AsyncStorage.getItem(CACHE_KEYS.OFFLINE_QUEUE);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
};

export const clearOfflineQueue = async () => {
    await AsyncStorage.removeItem(CACHE_KEYS.OFFLINE_QUEUE);
};

export const syncOfflineQueue = async (dosesAPI) => {
    const queue = await getOfflineQueue();
    if (queue.length === 0) return { synced: 0 };

    let synced = 0;
    const failed = [];

    for (const dose of queue) {
        try {
            await dosesAPI.log(dose.medicine_id, dose.scheduled_time, dose.status);
            synced++;
        } catch (e) {
            failed.push(dose);
        }
    }

    // Keep failed items for next sync
    if (failed.length > 0) {
        await AsyncStorage.setItem(CACHE_KEYS.OFFLINE_QUEUE, JSON.stringify(failed));
    } else {
        await clearOfflineQueue();
    }

    return { synced, remaining: failed.length };
};

export default CACHE_KEYS;
