from flask import Blueprint, request
from utils.auth_middleware import token_required
from utils.helpers import success_response, error_response
from models.caretaker import get_patients_for_caretaker, link_caretaker_patient, get_patient_detail
from models.alert import get_alerts_for_user, mark_alert_read, create_alert
from models.dose_log import get_adherence_stats, get_streak
from database.schema import get_connection

caretaker_bp = Blueprint('caretaker', __name__, url_prefix='/api/caretaker')


# ─── Caretaker Contact CRUD (manual name + phone) ───────────────

@caretaker_bp.route('/contacts', methods=['POST'])
@token_required
def add_contact():
    """Add a caretaker contact (name + phone)."""
    data = request.get_json()
    name = data.get('name', '').strip()
    phone = data.get('phone', '').strip()
    relationship = data.get('relationship', 'family')

    if not name or not phone:
        return error_response('Name and phone number are required')

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """INSERT INTO caretaker_contacts (user_id, name, phone, relationship)
               VALUES (%s, %s, %s, %s)""",
            (request.user_id, name, phone, relationship)
        )
        conn.commit()
        contact_id = cursor.lastrowid
    except Exception as e:
        conn.rollback()
        return error_response(f'Failed to add contact: {str(e)}')
    finally:
        cursor.close()
        conn.close()

    return success_response({
        'id': contact_id,
        'name': name,
        'phone': phone,
        'relationship': relationship,
    }, 'Caretaker contact added!', 201)


@caretaker_bp.route('/contacts', methods=['GET'])
@token_required
def list_contacts():
    """List all caretaker contacts."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """SELECT id, name, phone, relationship, is_active, created_at
           FROM caretaker_contacts
           WHERE user_id = %s AND is_active = 1
           ORDER BY created_at DESC""",
        (request.user_id,)
    )
    contacts = cursor.fetchall()
    for c in contacts:
        if c.get('created_at'):
            c['created_at'] = str(c['created_at'])
    cursor.close()
    conn.close()
    return success_response(contacts)


@caretaker_bp.route('/contacts/<int:contact_id>', methods=['DELETE'])
@token_required
def delete_contact(contact_id):
    """Delete a caretaker contact."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM caretaker_contacts WHERE id = %s AND user_id = %s",
        (contact_id, request.user_id)
    )
    conn.commit()
    affected = cursor.rowcount
    cursor.close()
    conn.close()

    if affected == 0:
        return error_response('Contact not found', 404)
    return success_response(None, 'Contact deleted')


@caretaker_bp.route('/contacts/<int:contact_id>', methods=['PUT'])
@token_required
def update_contact(contact_id):
    """Update a caretaker contact."""
    data = request.get_json()
    name = data.get('name', '').strip()
    phone = data.get('phone', '').strip()
    relationship = data.get('relationship', 'family')

    if not name or not phone:
        return error_response('Name and phone are required')

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """UPDATE caretaker_contacts SET name = %s, phone = %s, relationship = %s
           WHERE id = %s AND user_id = %s""",
        (name, phone, relationship, contact_id, request.user_id)
    )
    conn.commit()
    affected = cursor.rowcount
    cursor.close()
    conn.close()

    if affected == 0:
        return error_response('Contact not found', 404)
    return success_response({'id': contact_id, 'name': name, 'phone': phone}, 'Contact updated')


# ─── Background Auto-SMS Endpoint ──────────────────────────────

@caretaker_bp.route('/emergency/auto-sms', methods=['POST'])
@token_required
def background_auto_sms():
    """Called by background task when patient misses 3+ doses.
    Sends real SMS + voice call via Twilio to all caretaker contacts."""
    data = request.get_json()
    missed = data.get('missed_medicines', [])
    reason = data.get('reason', 'background_auto_check')

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    # Get patient name
    cursor.execute("SELECT name FROM users WHERE id = %s", (request.user_id,))
    user_row = cursor.fetchone()
    patient_name = user_row['name'] if user_row else 'Patient'

    # Get manual contacts
    cursor.execute(
        """SELECT id, name, phone, relationship
           FROM caretaker_contacts
           WHERE user_id = %s AND is_active = 1""",
        (request.user_id,)
    )
    contacts = cursor.fetchall()

    # Also fetch the user's phone number to send them the SMS and call as well
    cursor.execute("SELECT id, name, phone FROM users WHERE id = %s", (request.user_id,))
    user_with_phone = cursor.fetchone()
    if user_with_phone and user_with_phone.get('phone'):
        # Add the user to the contacts list so they receive the Twilio alert too
        contacts.append({
            'id': f"user_{request.user_id}",
            'name': user_with_phone['name'],
            'phone': user_with_phone['phone'],
            'relationship': 'self'
        })

    # Build alert info
    med_names = ', '.join([m.get('name', 'Unknown') for m in missed[:5]])

    # Send real SMS + Call via Twilio
    from utils.twilio_service import send_sms, make_call

    notifications = []
    for contact in contacts:
        contact_name = contact.get('name', 'Caretaker')

        # Personalized SMS message
        sms_text = (
            f"MEDITRACK ALERT: Hello {contact_name}, your patient {patient_name} "
            f"has NOT taken their medicine: {med_names}. "
            f"Please make sure they take their medicine as soon as possible. "
            f"This is an automated alert from MediTrack AI."
        )

        # Voice call message — spoken when caretaker picks up
        call_text = (
            f"Hello {contact_name}. This is an urgent message from MediTrack. "
            f"Your patient, {patient_name}, has not taken their medicine: {med_names}. "
            f"Please make sure that they take their medicine as soon as possible. "
            f"Thank you for being a responsible caretaker."
        )

        # Log the alert in DB
        create_alert(
            user_id=request.user_id,
            alert_type='emergency',
            title=f'🚨 Auto alert to {contact_name}',
            description=f'Background alert: missed {med_names}. SMS + Call sent to {contact["phone"]}.',
        )

        # Send SMS
        sms_result = send_sms(contact['phone'], sms_text)

        # Make voice call
        call_result = make_call(contact['phone'], call_text)

        notifications.append({
            'contact_name': contact['name'],
            'phone': contact['phone'],
            'sms_status': 'sent' if sms_result['success'] else 'failed',
            'sms_error': sms_result.get('error'),
            'call_status': 'initiated' if call_result['success'] else 'failed',
            'call_error': call_result.get('error'),
        })

    cursor.close()
    conn.close()

    return success_response({
        'contacts': notifications,
        'missed_count': len(missed),
        'sms_triggered': len(contacts) > 0,
        'total_notified': len(contacts),
    }, f'Auto SMS + Call triggered for {len(contacts)} contact(s)')


# ─── Original Caretaker Routes ──────────────────────────────────

@caretaker_bp.route('/patients', methods=['GET'])
@token_required
def list_patients():
    """Get all linked patients for caretaker."""
    patients = get_patients_for_caretaker(request.user_id)
    return success_response(patients)


@caretaker_bp.route('/link', methods=['POST'])
@token_required
def link():
    """Link to a patient by email."""
    data = request.get_json()
    email = data.get('patient_email', '').strip()
    relationship = data.get('relationship', 'family')

    if not email:
        return error_response('Patient email is required')

    # Find user by email
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, name FROM users WHERE email = %s", (email,))
    patient = cursor.fetchone()
    cursor.close()
    conn.close()

    if not patient:
        return error_response('No patient found with that email')

    link_id = link_caretaker_patient(request.user_id, patient['id'], relationship)
    if not link_id:
        return error_response('Already linked to this patient')

    return success_response({'link_id': link_id, 'patient_name': patient['name']}, 'Patient linked', 201)


@caretaker_bp.route('/patient/<int:patient_id>', methods=['GET'])
@token_required
def patient_detail(patient_id):
    """Get detailed info for a specific patient."""
    patient = get_patient_detail(request.user_id, patient_id)
    if not patient:
        return error_response('Patient not found or not linked', 404)

    # Add adherence stats
    stats = get_adherence_stats(patient_id, 30)
    streak = get_streak(patient_id)

    return success_response({
        'patient': patient,
        'adherence': stats['adherencePercentage'],
        'streak': streak,
        'taken': stats['taken'],
        'missed': stats['missed'],
        'total': stats['total'],
    })


@caretaker_bp.route('/alerts', methods=['GET'])
@token_required
def list_alerts():
    """Get alerts for caretaker's patients."""
    alerts = get_alerts_for_user(request.user_id)
    return success_response(alerts)


@caretaker_bp.route('/alerts/<int:alert_id>/read', methods=['PUT'])
@token_required
def read_alert(alert_id):
    """Mark an alert as read."""
    mark_alert_read(alert_id, request.user_id)
    return success_response(None, 'Alert marked as read')


@caretaker_bp.route('/report/<int:patient_id>', methods=['GET'])
@token_required
def get_report(patient_id):
    """Generate weekly/monthly report for a patient."""
    period = request.args.get('period', 'weekly')
    days = 7 if period == 'weekly' else 30

    patient = get_patient_detail(request.user_id, patient_id)
    if not patient:
        return error_response('Patient not found', 404)

    stats = get_adherence_stats(patient_id, days)
    streak = get_streak(patient_id)

    # Get medicine breakdown
    from models.dose_log import get_medication_breakdown
    breakdown = get_medication_breakdown(patient_id, days)

    # Get recent alerts
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT type, title, description, created_at
        FROM alerts WHERE user_id = %s
        ORDER BY created_at DESC LIMIT 10
    """, (patient_id,))
    recent_alerts = cursor.fetchall()
    for a in recent_alerts:
        if a.get('created_at'):
            a['created_at'] = str(a['created_at'])
    cursor.close()
    conn.close()

    return success_response({
        'patient': patient,
        'period': period,
        'days': days,
        'adherence': stats['adherencePercentage'],
        'streak': streak,
        'taken': stats['taken'],
        'missed': stats['missed'],
        'total': stats['total'],
        'weeklyAdherence': stats.get('weeklyAdherence', []),
        'medicationBreakdown': breakdown,
        'alerts': recent_alerts,
        'summary': f"{'Good' if stats['adherencePercentage'] >= 80 else 'Needs Attention'} - "
                   f"{stats['adherencePercentage']}% adherence over {days} days.",
    })


# ─── Emergency Auto Alert System ─────────────────────────────────

@caretaker_bp.route('/emergency/check', methods=['POST'])
@token_required
def emergency_check():
    """Auto-check for missed doses and trigger alerts if needed."""
    from models.emergency_alert import auto_check_and_alert

    data = request.get_json() or {}
    location = data.get('location', None)  # {latitude, longitude, address}

    result = auto_check_and_alert(request.user_id, location)
    if result is None:
        return success_response({'triggered': False, 'missed_count': 0, 'message': 'All doses taken!'})

    return success_response(result)


@caretaker_bp.route('/emergency/trigger', methods=['POST'])
@token_required
def emergency_trigger():
    """Manually trigger an emergency alert to all caretakers."""
    from models.emergency_alert import check_missed_doses, trigger_emergency_alert

    data = request.get_json() or {}
    location = data.get('location', None)
    reason = data.get('reason', 'manual')

    missed = check_missed_doses(request.user_id)
    if not missed:
        missed = [{'name': 'Unknown', 'dosage': '', 'time': ''}]

    result = trigger_emergency_alert(request.user_id, missed, reason, location)
    return success_response(result, 'Emergency alert sent!')


@caretaker_bp.route('/emergency/status', methods=['GET'])
@token_required
def emergency_status():
    """Get current emergency status — missed doses and alert threshold."""
    from models.emergency_alert import check_missed_doses, get_consecutive_misses, is_critical_medicine

    missed = check_missed_doses(request.user_id)
    miss_count = get_consecutive_misses(request.user_id)

    critical = [m for m in missed if is_critical_medicine(m['name'], m.get('instruction', ''))]

    needs_alert = len(missed) > 0

    return success_response({
        'missed_count': miss_count,
        'missed_medicines': [{'name': m['name'], 'time': m.get('time', '')} for m in missed],
        'critical_missed': [{'name': m['name'], 'time': m.get('time', '')} for m in critical],
        'needs_alert': needs_alert,
        'threshold': 1,
        'alert_reason': 'missed_dose' if needs_alert else None,
    })

