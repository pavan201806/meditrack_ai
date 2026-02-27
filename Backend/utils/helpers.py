from flask import jsonify
from datetime import datetime, timedelta


def success_response(data=None, message='Success', status=200):
    """Standard success response."""
    response = {'success': True, 'message': message}
    if data is not None:
        response['data'] = data
    return jsonify(response), status


def error_response(message='An error occurred', status=400):
    """Standard error response."""
    return jsonify({'success': False, 'error': message}), status


def format_time_ago(dt):
    """Format a datetime to relative time string (e.g., '5 mins ago')."""
    if not dt:
        return 'Unknown'

    now = datetime.utcnow()
    diff = now - dt

    if diff.total_seconds() < 60:
        return 'Just now'
    elif diff.total_seconds() < 3600:
        mins = int(diff.total_seconds() / 60)
        return f'{mins} min{"s" if mins > 1 else ""} ago'
    elif diff.total_seconds() < 86400:
        hours = int(diff.total_seconds() / 3600)
        return f'{hours}h ago'
    elif diff.days == 1:
        return 'Yesterday'
    else:
        return f'{diff.days} days ago'


def get_week_dates():
    """Get start and end dates for the current week (Mon-Sun)."""
    today = datetime.utcnow().date()
    start = today - timedelta(days=today.weekday())
    end = start + timedelta(days=6)
    return start, end


def format_time_12h(time_str):
    """Convert HH:MM to 12-hour format."""
    try:
        t = datetime.strptime(time_str, '%H:%M')
        return t.strftime('%I:%M %p')
    except Exception:
        return time_str
