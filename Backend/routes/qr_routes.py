from flask import Blueprint, request, jsonify
from utils.auth_middleware import token_required
from utils.helpers import success_response, error_response
from database.schema import get_connection
import hashlib
import json

qr_bp = Blueprint('qr', __name__, url_prefix='/api/qr')


@qr_bp.route('/generate/<int:medicine_id>', methods=['GET'])
@token_required
def generate_qr(medicine_id):
    """Generate a unique QR code string for a medicine."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM medicines WHERE id = %s AND user_id = %s", (medicine_id, request.user_id))
    med = cursor.fetchone()

    if not med:
        cursor.close()
        conn.close()
        return error_response('Medicine not found', 404)

    # Generate deterministic QR payload
    qr_payload = {
        'type': 'meditrack_dose',
        'medicine_id': medicine_id,
        'user_id': request.user_id,
        'name': med['name'],
        'dosage': med['dosage'],
    }
    qr_string = json.dumps(qr_payload, sort_keys=True)
    qr_hash = hashlib.sha256(qr_string.encode()).hexdigest()[:16]
    qr_code = f"MT-{medicine_id}-{qr_hash}"

    # Store QR code in DB
    cursor.execute("UPDATE medicines SET qr_code = %s WHERE id = %s", (qr_code, medicine_id))
    conn.commit()
    cursor.close()
    conn.close()

    return success_response({
        'qr_code': qr_code,
        'qr_data': qr_payload,
        'medicine_name': med['name'],
    })


@qr_bp.route('/scan', methods=['POST'])
@token_required
def scan_qr():
    """Scan a QR code to auto-log dose completion."""
    data = request.get_json()
    qr_code = data.get('qr_code', '').strip()

    if not qr_code:
        return error_response('QR code is required')

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    # Find medicine by QR code
    cursor.execute(
        "SELECT * FROM medicines WHERE qr_code = %s AND user_id = %s AND is_active = TRUE",
        (qr_code, request.user_id)
    )
    med = cursor.fetchone()

    if not med:
        cursor.close()
        conn.close()
        return error_response('Invalid QR code or medicine not found', 404)

    # Log dose
    from datetime import datetime, date
    from models.dose_log import log_dose

    now = datetime.now()
    scheduled_time = now.strftime('%H:%M')
    log_id = log_dose(request.user_id, med['id'], scheduled_time, 'taken')

    # Decrement pills_remaining
    cursor.execute(
        "UPDATE medicines SET pills_remaining = GREATEST(0, pills_remaining - %s) WHERE id = %s",
        (med.get('pill_count', 1) or 1, med['id'])
    )
    conn.commit()
    cursor.close()
    conn.close()

    return success_response({
        'log_id': log_id,
        'medicine': med['name'],
        'dosage': med['dosage'],
        'status': 'taken',
        'time': now.strftime('%I:%M %p'),
    }, f'{med["name"]} dose logged!')
