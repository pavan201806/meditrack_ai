from flask import Blueprint, request
from utils.auth_middleware import token_required
from utils.helpers import success_response, error_response
from database.schema import get_connection
from datetime import date

health_bp = Blueprint('health', __name__, url_prefix='/api/health')


@health_bp.route('/log', methods=['POST'])
@token_required
def log_health():
    """Log health data (steps, sleep)."""
    data = request.get_json()
    steps = data.get('steps', 0)
    sleep_hours = data.get('sleep_hours', 0)
    sleep_mins = data.get('sleep_mins', 0)
    insight_date = data.get('date', str(date.today()))

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO health_insights (user_id, steps, sleep_hours, sleep_mins, insight_date)
           VALUES (%s, %s, %s, %s, %s)
           ON DUPLICATE KEY UPDATE steps = VALUES(steps), sleep_hours = VALUES(sleep_hours),
           sleep_mins = VALUES(sleep_mins)""",
        (request.user_id, steps, sleep_hours, sleep_mins, insight_date)
    )
    conn.commit()
    cursor.close()
    conn.close()

    return success_response(message='Health data logged')


@health_bp.route('/today', methods=['GET'])
@token_required
def today_health():
    """Get today's health insights."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT * FROM health_insights WHERE user_id = %s AND insight_date = CURDATE()",
        (request.user_id,)
    )
    data = cursor.fetchone()
    cursor.close()
    conn.close()

    if not data:
        data = {'steps': 0, 'sleep_hours': 0, 'sleep_mins': 0}
    else:
        if data.get('insight_date'):
            data['insight_date'] = str(data['insight_date'])
        if data.get('created_at'):
            data['created_at'] = str(data['created_at'])

    return success_response(data)
