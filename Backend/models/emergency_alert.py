"""
Emergency Auto Alert System - Hackathon Killer Feature
Tracks missed critical doses and auto-notifies caretakers via SMS/push.
"""
from database.schema import get_connection
from models.alert import create_alert
from datetime import datetime, timedelta


def check_missed_doses(user_id):
    """Check for unresponded/missed critical doses in the last 2 hours."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    two_hours_ago = datetime.now() - timedelta(hours=2)

    # Count missed doses today (scheduled times that passed without a dose log)
    cursor.execute("""
        SELECT m.id, m.name, m.dosage, m.frequency, m.instruction, ms.time
        FROM medicines m
        JOIN medicine_schedules ms ON m.id = ms.medicine_id
        WHERE m.user_id = %s AND m.is_active = 1
        AND ms.time < TIME(NOW())
        AND NOT EXISTS (
            SELECT 1 FROM dose_logs dl
            WHERE dl.medicine_id = m.id
            AND dl.scheduled_time = ms.time
            AND DATE(dl.taken_at) = CURDATE()
        )
    """, (user_id,))
    missed = cursor.fetchall()

    # Serialize time objects
    for m in missed:
        if m.get('time'):
            m['time'] = str(m['time'])

    cursor.close()
    conn.close()
    return missed


def get_consecutive_misses(user_id):
    """Get count of consecutive missed doses (no dose logs in recent schedule windows)."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    # Count missed doses today
    cursor.execute("""
        SELECT COUNT(*) as miss_count FROM (
            SELECT m.id, ms.time
            FROM medicines m
            JOIN medicine_schedules ms ON m.id = ms.medicine_id
            WHERE m.user_id = %s AND m.is_active = 1
            AND ms.time < TIME(NOW())
            AND NOT EXISTS (
                SELECT 1 FROM dose_logs dl
                WHERE dl.medicine_id = m.id
                AND dl.scheduled_time = ms.time
                AND DATE(dl.taken_at) = CURDATE()
            )
        ) AS missed
    """, (user_id,))
    result = cursor.fetchone()

    cursor.close()
    conn.close()
    return result['miss_count'] if result else 0


def is_critical_medicine(medicine_name, instruction):
    """Check if a medicine is critical (heart, BP, diabetes, etc)."""
    critical_keywords = [
        'heart', 'cardiac', 'blood pressure', 'bp', 'hypertension',
        'diabetes', 'insulin', 'metformin', 'aspirin', 'warfarin',
        'anticoagulant', 'nitroglycerin', 'atenolol', 'amlodipine',
        'losartan', 'enalapril', 'lisinopril', 'ramipril',
        'clopidogrel', 'statin', 'atorvastatin', 'rosuvastatin',
        'critical', 'emergency', 'life-saving',
    ]
    name_lower = (medicine_name or '').lower()
    instr_lower = (instruction or '').lower()
    return any(kw in name_lower or kw in instr_lower for kw in critical_keywords)


def trigger_emergency_alert(user_id, missed_medicines, reason, location=None):
    """
    Trigger emergency alert to all linked caretakers AND manual contacts.
    Creates alerts, simulates SMS to phone numbers, returns alert data.
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    # Get user info
    cursor.execute("SELECT name, email FROM users WHERE id = %s", (user_id,))
    user = cursor.fetchone()
    user_name = user['name'] if user else 'Patient'

    # Get registered caretakers (from caretaker_patients table)
    cursor.execute("""
        SELECT cp.caretaker_id, u.name as caretaker_name, u.email as caretaker_email
        FROM caretaker_patients cp
        JOIN users u ON cp.caretaker_id = u.id
        WHERE cp.patient_id = %s
    """, (user_id,))
    caretakers = cursor.fetchall()

    # Get manual caretaker contacts (name + phone)
    cursor.execute("""
        SELECT id, name, phone, relationship
        FROM caretaker_contacts
        WHERE user_id = %s AND is_active = 1
    """, (user_id,))
    manual_contacts = cursor.fetchall()
    
    # Also fetch the user's phone number to send them the SMS and call as well
    cursor.execute("SELECT id, name, phone FROM users WHERE id = %s", (user_id,))
    user_with_phone = cursor.fetchone()
    if user_with_phone and user_with_phone.get('phone'):
        # Add the user to the manual_contacts list so they receive the Twilio alert too
        manual_contacts.append({
            'id': f"user_{user_id}",
            'name': user_with_phone['name'],
            'phone': user_with_phone['phone'],
            'relationship': 'self'
        })

    # Build alert message
    med_names = ', '.join([m['name'] for m in missed_medicines[:3]])
    if len(missed_medicines) > 3:
        med_names += f' (+{len(missed_medicines) - 3} more)'

    if reason == 'critical_missed':
        title = f'🚨 CRITICAL: {user_name} missed critical medicine!'
        description = f'{user_name} has missed critical medication: {med_names}. Immediate attention required.'
        alert_type = 'emergency'
    elif reason == 'consecutive_misses':
        title = f'⚠️ ALERT: {user_name} missed {len(missed_medicines)} doses!'
        description = f'{user_name} has not responded to {len(missed_medicines)} scheduled doses: {med_names}.'
        alert_type = 'emergency'
    elif reason == 'sos':
        title = f'🆘 SOS from {user_name}!'
        description = f'{user_name} has triggered an emergency SOS alert. Missed medicines: {med_names}.'
        alert_type = 'emergency'
    else: # reason is 'missed_dose' or 'manual'
        title = f'🚨 ALERT: {user_name} has missed medicine!'
        description = f'{user_name} has missed medicine: {med_names}. Please check on them.'
        alert_type = 'emergency'

    if location:
        description += f'\n📍 Last known location: {location.get("address", "Unknown")}'
        description += f'\n🗺️ Coordinates: {location.get("latitude", "N/A")}, {location.get("longitude", "N/A")}'

    # Create alert for each registered caretaker
    alert_ids = []
    sms_sent = []
    for ct in caretakers:
        alert_id = create_alert(
            user_id=user_id,
            alert_type=alert_type,
            title=title,
            description=description,
            caretaker_id=ct['caretaker_id']
        )
        alert_ids.append(alert_id)

    # Send SMS + Voice Call to all manual contacts via Twilio
    from utils.twilio_service import send_sms, make_call

    for contact in manual_contacts:
        contact_name = contact.get('name', 'Caretaker')

        # SMS message
        sms_msg = (
            f"MEDITRACK ALERT: Hello {contact_name}, your patient {user_name} "
            f"has NOT taken their medicine: {med_names}. "
            f"Please make sure they take their medicine as soon as possible. "
            f"This is an automated alert from MediTrack AI."
        )

        # Voice call message — spoken when caretaker picks up
        call_msg = (
            f"Hello {contact_name}. This is an urgent message from MediTrack. "
            f"Your patient, {user_name}, has not taken their medicine: {med_names}. "
            f"Please make sure that they take their medicine as soon as possible. "
            f"Thank you for being a responsible caretaker."
        )

        # Send SMS
        sms_result = send_sms(contact['phone'], sms_msg)

        # Make voice call
        call_result = make_call(contact['phone'], call_msg)

        sms_sent.append({
            'contact_name': contact['name'],
            'phone': contact['phone'],
            'relationship': contact.get('relationship', 'family'),
            'sms_status': 'sent' if sms_result['success'] else 'failed',
            'sms_sid': sms_result.get('sid'),
            'sms_error': sms_result.get('error'),
            'call_status': 'initiated' if call_result['success'] else 'failed',
            'call_sid': call_result.get('sid'),
            'call_error': call_result.get('error'),
            'message_preview': sms_msg[:160],
        })

        # Also create an alert record for this SMS
        create_alert(
            user_id=user_id,
            alert_type=alert_type,
            title=f'SMS sent to {contact["name"]}',
            description=f'Emergency SMS sent to {contact["phone"]}: {sms_msg[:100]}...',
        )

    # Create alert for the patient themselves
    total_notified = len(caretakers) + len(manual_contacts)
    patient_alert_id = create_alert(
        user_id=user_id,
        alert_type=alert_type,
        title='🚨 Emergency alert sent to your caretaker(s)',
        description=f'{total_notified} caretaker(s) notified. SMS sent to: {", ".join([c["name"] + " (" + c["phone"] + ")" for c in manual_contacts]) or "None"}',
    )

    cursor.close()
    conn.close()

    return {
        'triggered': True,
        'reason': reason,
        'alert_ids': alert_ids,
        'sms_notifications': sms_sent,
        'caretakers_notified': total_notified,
        'missed_medicines': [{'name': m['name'], 'dosage': m.get('dosage', ''), 'time': m.get('time', '')} for m in missed_medicines],
        'location': location,
        'timestamp': datetime.now().isoformat(),
    }


def auto_check_and_alert(user_id, location=None):
    """
    Main function: automatically checks for missed doses and triggers alerts.
    Returns alert data if triggered, None otherwise.
    
    Triggers when:
    1. Any medicine is missed
    """
    missed = check_missed_doses(user_id)
    if not missed:
        return None

    # Trigger alert for ANY missed dose
    return trigger_emergency_alert(user_id, missed, 'missed_dose', location)
