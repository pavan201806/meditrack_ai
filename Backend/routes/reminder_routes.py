from flask import Blueprint, request
from utils.auth_middleware import token_required
from utils.helpers import success_response, error_response
from models.reminder import get_reminders, create_reminder, take_reminder, snooze_reminder
from ml.smart_reminder import track_behavior, get_adaptive_schedule

reminder_bp = Blueprint('reminders', __name__, url_prefix='/api/reminders')


@reminder_bp.route('', methods=['GET'])
@token_required
def list_reminders():
    """Get upcoming and completed reminders."""
    data = get_reminders(request.user_id)
    return success_response(data)


@reminder_bp.route('', methods=['POST'])
@token_required
def add_reminder():
    """Create a new reminder."""
    data = request.get_json()
    rid = create_reminder(
        user_id=request.user_id,
        medicine_id=data.get('medicine_id'),
        scheduled_time=data.get('scheduled_time'),
        voice_enabled=data.get('voice_enabled', True),
    )
    return success_response({'reminder_id': rid}, 'Reminder created', 201)


@reminder_bp.route('/<int:reminder_id>/take', methods=['PUT'])
@token_required
def take(reminder_id):
    """Mark reminder as taken and track behavior."""
    take_reminder(reminder_id, request.user_id)

    # Track positive behavior
    data = request.get_json() or {}
    medicine_id = data.get('medicine_id')
    delay = data.get('delay_mins', 0)
    if medicine_id:
        track_behavior(request.user_id, medicine_id, 'take', delay)

    return success_response(None, 'Marked as taken')


@reminder_bp.route('/<int:reminder_id>/snooze', methods=['PUT'])
@token_required
def snooze(reminder_id):
    """Snooze a reminder and track behavior."""
    snooze_reminder(reminder_id, request.user_id)

    data = request.get_json() or {}
    medicine_id = data.get('medicine_id')
    if medicine_id:
        track_behavior(request.user_id, medicine_id, 'snooze')

    return success_response(None, 'Snoozed for 10 minutes')


@reminder_bp.route('/<int:reminder_id>/miss', methods=['PUT'])
@token_required
def miss(reminder_id):
    """Mark reminder as missed and trigger escalation if needed."""
    data = request.get_json() or {}
    medicine_id = data.get('medicine_id')
    if medicine_id:
        track_behavior(request.user_id, medicine_id, 'miss')

    return success_response(None, 'Marked as missed')


@reminder_bp.route('/adaptive', methods=['GET'])
@token_required
def adaptive_schedule():
    """Get adaptive schedule suggestions based on behavior."""
    suggestions = get_adaptive_schedule(request.user_id)
    return success_response({
        'suggestions': suggestions,
        'count': len(suggestions),
    })
