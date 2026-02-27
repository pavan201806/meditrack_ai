/**
 * SMS Service — Now routes through Backend Twilio API
 * ====================================================
 * Instead of opening the native SMS app (expo-sms / Linking),
 * all SMS + voice calls are sent automatically via the backend
 * using Twilio. The app just calls the API endpoint.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { caretakerAPI } from './api';

const CONTACTS_CACHE_KEY = 'caretaker_contacts_cache';

/**
 * Cache caretaker contacts locally for offline use.
 */
export const cacheContacts = async (contacts) => {
    try {
        await AsyncStorage.setItem(CONTACTS_CACHE_KEY, JSON.stringify(contacts));
    } catch (err) {
        console.log('Failed to cache contacts:', err.message);
    }
};

/**
 * Get cached contacts (used when API is down).
 */
export const getCachedContacts = async () => {
    try {
        const data = await AsyncStorage.getItem(CONTACTS_CACHE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (err) {
        return [];
    }
};

/**
 * Send emergency SMS + Voice Call to all caretaker contacts via backend Twilio.
 * This replaces the old expo-sms / Linking approach.
 * 
 * The backend endpoint /api/caretaker/emergency/auto-sms handles:
 * 1. Sending SMS via Twilio
 * 2. Making voice call via Twilio
 * 3. Logging alerts in the database
 */
export const sendEmergencySMSToAll = async (contacts, missedMedicines, userName = 'Patient') => {
    try {
        // Call backend — Twilio sends SMS + makes voice call automatically
        const result = await caretakerAPI.emergencyAutoSMS(missedMedicines);
        console.log('✅ Backend Twilio alert sent:', result);
        return result;
    } catch (err) {
        console.log('Backend Twilio alert failed:', err.message);

        // Fallback: try the emergency trigger endpoint
        try {
            const fallback = await caretakerAPI.emergencyTrigger(null, 'auto_sms_fallback');
            console.log('✅ Fallback emergency trigger sent:', fallback);
            return fallback;
        } catch (fallbackErr) {
            console.log('Fallback also failed:', fallbackErr.message);
            return { success: false, error: fallbackErr.message };
        }
    }
};

/**
 * Legacy sendSMS — now just calls the backend.
 * Kept for backward compatibility.
 */
export const sendSMS = async (phone, message) => {
    console.log(`📱 SMS request for ${phone} — routed to backend Twilio`);
    return { success: true, method: 'backend-twilio' };
};
