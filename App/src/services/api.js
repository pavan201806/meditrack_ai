/**
 * MediTrack AI — API Service Layer (Enhanced v2.0)
 * All backend communication goes through this file.
 * Includes offline fallback and sync queue.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { queueOfflineDose, syncOfflineQueue } from './offlineCache';

// ⚠️ Change this to your backend's IP (your Mac's network IP for physical devices)
// For Android emulator use: http://10.0.2.2:5001
// For iOS simulator use: http://localhost:5001
// For physical device use your Mac's IP
const BASE_URL = 'http://172.17.124.132:5001';

const TOKEN_KEY = 'meditrack_auth_token';

// ─── Token Management ───────────────────────────────────────────

export const saveToken = async (token) => {
    await AsyncStorage.setItem(TOKEN_KEY, token);
};

export const getToken = async () => {
    return await AsyncStorage.getItem(TOKEN_KEY);
};

export const removeToken = async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
};

// ─── Base Request Helper ────────────────────────────────────────

const request = async (endpoint, options = {}) => {
    const token = await getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };

    const config = { ...options, headers };

    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, config);
        const data = await response.json();

        if (!response.ok) {
            throw { status: response.status, message: data.error || 'Request failed' };
        }

        return data;
    } catch (error) {
        if (error.status) throw error;
        throw { status: 0, message: 'Network error — is the backend running?' };
    }
};

// ─── Auth API ───────────────────────────────────────────────────

export const authAPI = {
    signup: async (name, email, phone, password, role = 'patient') => {
        const res = await request('/api/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ name, email, phone, password, role }),
        });
        if (res.data?.token) await saveToken(res.data.token);
        return res;
    },

    login: async (email, password) => {
        const res = await request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        if (res.data?.token) await saveToken(res.data.token);
        return res;
    },

    logout: async () => {
        await removeToken();
    },
};

// ─── Medicines API ──────────────────────────────────────────────

export const medicinesAPI = {
    list: () => request('/api/medicines'),
    get: (id) => request(`/api/medicines/${id}`),
    create: (medicine) => request('/api/medicines', {
        method: 'POST',
        body: JSON.stringify(medicine),
    }),
    update: (id, data) => request(`/api/medicines/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    delete: (id) => request(`/api/medicines/${id}`, { method: 'DELETE' }),
    refills: () => request('/api/medicines/refills'),
    insights: (medicines) => request('/api/medicines/insights', {
        method: 'POST',
        body: JSON.stringify({ medicines }),
    }),
};

// ─── Reminders API ──────────────────────────────────────────────

export const remindersAPI = {
    list: () => request('/api/reminders'),
    create: (reminder) => request('/api/reminders', {
        method: 'POST',
        body: JSON.stringify(reminder),
    }),
    take: (id, medicineId, delayMins = 0) => request(`/api/reminders/${id}/take`, {
        method: 'PUT',
        body: JSON.stringify({ medicine_id: medicineId, delay_mins: delayMins }),
    }),
    snooze: (id, medicineId) => request(`/api/reminders/${id}/snooze`, {
        method: 'PUT',
        body: JSON.stringify({ medicine_id: medicineId }),
    }),
    miss: (id, medicineId) => request(`/api/reminders/${id}/miss`, {
        method: 'PUT',
        body: JSON.stringify({ medicine_id: medicineId }),
    }),
    adaptive: () => request('/api/reminders/adaptive'),
};

// ─── Doses API (with offline fallback) ──────────────────────────

export const dosesAPI = {
    log: async (medicineId, scheduledTime, status = 'taken') => {
        try {
            return await request('/api/doses/log', {
                method: 'POST',
                body: JSON.stringify({
                    medicine_id: medicineId,
                    scheduled_time: scheduledTime,
                    status,
                }),
            });
        } catch (err) {
            // Queue for offline sync
            if (err.status === 0) {
                await queueOfflineDose({ medicine_id: medicineId, scheduled_time: scheduledTime, status });
                return { success: true, offline: true, message: 'Saved offline — will sync later' };
            }
            throw err;
        }
    },
    today: () => request('/api/doses/today'),
    sync: () => syncOfflineQueue(dosesAPI),
};

// ─── Dashboard API ──────────────────────────────────────────────

export const dashboardAPI = {
    get: () => request('/api/dashboard'),
};

// ─── Analytics API ──────────────────────────────────────────────

export const analyticsAPI = {
    get: (days = 7) => request(`/api/analytics?days=${days}`),
    insights: () => request('/api/analytics/insights'),
    risk: () => request('/api/analytics/risk'),
    monthly: () => request('/api/analytics/monthly'),
};

// ─── Scanner API ────────────────────────────────────────────────

export const scannerAPI = {
    scan: async (imageBase64) => {
        return request('/api/scanner/scan', {
            method: 'POST',
            body: JSON.stringify({ image: imageBase64 }),
        });
    },
    validate: (medicines) => request('/api/scanner/validate', {
        method: 'POST',
        body: JSON.stringify({ medicines }),
    }),
    confirm: (medicine) => request('/api/scanner/confirm', {
        method: 'POST',
        body: JSON.stringify(medicine),
    }),
    confirmBatch: (medicines) => request('/api/scanner/confirm-batch', {
        method: 'POST',
        body: JSON.stringify({ medicines }),
    }),
};

// ─── QR API ─────────────────────────────────────────────────────

export const qrAPI = {
    generate: (medicineId) => request(`/api/qr/generate/${medicineId}`),
    scan: (qrCode) => request('/api/qr/scan', {
        method: 'POST',
        body: JSON.stringify({ qr_code: qrCode }),
    }),
};

// ─── Interactions API ───────────────────────────────────────────

export const interactionsAPI = {
    check: (medicineNames) => request('/api/interactions/check', {
        method: 'POST',
        body: JSON.stringify({ medicine_names: medicineNames }),
    }),
    checkNew: (medicineName) => request('/api/interactions/check-new', {
        method: 'POST',
        body: JSON.stringify({ medicine_name: medicineName }),
    }),
};

// ─── Caretaker API ──────────────────────────────────────────────

export const caretakerAPI = {
    patients: () => request('/api/caretaker/patients'),
    link: (patientEmail, relationship = 'family') =>
        request('/api/caretaker/link', {
            method: 'POST',
            body: JSON.stringify({ patient_email: patientEmail, relationship }),
        }),
    patientDetail: (patientId) => request(`/api/caretaker/patient/${patientId}`),
    alerts: () => request('/api/caretaker/alerts'),
    markRead: (alertId) => request(`/api/caretaker/alerts/${alertId}/read`, { method: 'PUT' }),
    report: (patientId, period = 'weekly') =>
        request(`/api/caretaker/report/${patientId}?period=${period}`),
    emergencyCheck: (location = null) =>
        request('/api/caretaker/emergency/check', {
            method: 'POST',
            body: JSON.stringify({ location }),
        }),
    emergencyTrigger: (location = null, reason = 'manual') =>
        request('/api/caretaker/emergency/trigger', {
            method: 'POST',
            body: JSON.stringify({ location, reason }),
        }),
    emergencyStatus: () => request('/api/caretaker/emergency/status'),
    addContact: (name, phone, relationship = 'family') =>
        request('/api/caretaker/contacts', {
            method: 'POST',
            body: JSON.stringify({ name, phone, relationship }),
        }),
    listContacts: () => request('/api/caretaker/contacts'),
    deleteContact: (contactId) =>
        request(`/api/caretaker/contacts/${contactId}`, { method: 'DELETE' }),
    emergencyAutoSMS: (missedMedicines) =>
        request('/api/caretaker/emergency/auto-sms', {
            method: 'POST',
            body: JSON.stringify({
                missed_medicines: missedMedicines,
                reason: 'auto_sms',
            }),
        }),
};

// ─── Health API ─────────────────────────────────────────────────

export const healthAPI = {
    log: (steps, sleepHours, sleepMins) =>
        request('/api/health/log', {
            method: 'POST',
            body: JSON.stringify({ steps, sleep_hours: sleepHours, sleep_mins: sleepMins }),
        }),
    today: () => request('/api/health/today'),
};
