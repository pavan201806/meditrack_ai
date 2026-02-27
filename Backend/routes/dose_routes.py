from flask import Blueprint, request
from utils.auth_middleware import token_required
from utils.helpers import success_response, error_response
from models.dose_log import log_dose, get_today_doses

dose_bp = Blueprint('dose', __name__, url_prefix='/api/doses')


@dose_bp.route('/log', methods=['POST'])
@token_required
def log_dose_taken():
    """Log a dose as taken or missed."""
    data = request.get_json()

    medicine_id = data.get('medicine_id')
    scheduled_time = data.get('scheduled_time')
    status = data.get('status', 'taken')

    if not medicine_id or not scheduled_time:
        return error_response('Medicine ID and scheduled time are required')

    if status not in ('taken', 'missed', 'snoozed'):
        return error_response('Status must be taken, missed, or snoozed')

    log_id = log_dose(request.user_id, medicine_id, scheduled_time, status)
    return success_response({'id': log_id}, f'Dose marked as {status}')


@dose_bp.route('/today', methods=['GET'])
@token_required
def today_doses():
    """Get all dose logs for today."""
    doses = get_today_doses(request.user_id)
    return success_response(doses)
