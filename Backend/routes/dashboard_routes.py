from flask import Blueprint, request
from utils.auth_middleware import token_required
from utils.helpers import success_response, error_response
from models.medicine import get_medicines_by_user
from models.dose_log import get_adherence_stats, get_streak, get_today_doses
from datetime import datetime

dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/api/dashboard')


@dashboard_bp.route('', methods=['GET'])
@token_required
def get_dashboard():
    """Get dashboard data: adherence, streak, doses left, next dose."""
    user_id = request.user_id

    # Get adherence stats
    stats = get_adherence_stats(user_id, 7)
    streak = get_streak(user_id)

    # Get today's doses to calculate doses left
    today_doses = get_today_doses(user_id)
    medicines = get_medicines_by_user(user_id)

    # Calculate doses left today
    taken_today = len([d for d in today_doses if d['status'] == 'taken'])
    total_today = sum(len(m.get('schedule', [])) for m in medicines)
    doses_left = max(0, total_today - taken_today)

    # Determine status
    if stats['adherencePercentage'] >= 90:
        status = 'Excellent'
    elif stats['adherencePercentage'] >= 70:
        status = 'On Track'
    elif stats['adherencePercentage'] >= 50:
        status = 'Needs Attention'
    else:
        status = 'Critical'

    # Find next dose
    now = datetime.now()
    next_dose = None
    for med in medicines:
        for schedule_time in med.get('schedule', []):
            try:
                # Parse schedule time
                t = datetime.strptime(schedule_time, '%H:%M')
                dose_time = now.replace(hour=t.hour, minute=t.minute, second=0)
                if dose_time > now:
                    if next_dose is None or dose_time < next_dose['_dt']:
                        next_dose = {
                            'medicine': med['name'],
                            'dosage': med['dosage'],
                            'instruction': med.get('instruction', ''),
                            'target_time': dose_time.isoformat(),
                            '_dt': dose_time,
                        }
            except ValueError:
                # Try 12-hour format
                try:
                    t = datetime.strptime(schedule_time, '%I:%M %p')
                    dose_time = now.replace(hour=t.hour, minute=t.minute, second=0)
                    if dose_time > now:
                        if next_dose is None or dose_time < next_dose['_dt']:
                            next_dose = {
                                'medicine': med['name'],
                                'dosage': med['dosage'],
                                'instruction': med.get('instruction', ''),
                                'target_time': dose_time.isoformat(),
                                '_dt': dose_time,
                            }
                except ValueError:
                    continue

    # Remove internal _dt key before returning
    if next_dose:
        next_dose.pop('_dt', None)

    return success_response({
        'adherencePercentage': stats['adherencePercentage'],
        'streak': streak,
        'status': status,
        'dosesLeft': doses_left,
        'nextDose': next_dose,
        'todayDoses': today_doses,
    })
