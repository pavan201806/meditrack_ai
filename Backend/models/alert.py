from database.schema import get_connection
from utils.helpers import format_time_ago


def create_alert(user_id, alert_type, title, description, caretaker_id=None):
    """Create a new alert."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO alerts (user_id, caretaker_id, type, title, description)
           VALUES (%s, %s, %s, %s, %s)""",
        (user_id, caretaker_id, alert_type, title, description)
    )
    conn.commit()
    alert_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return alert_id


def get_alerts_for_user(user_id, limit=20):
    """Get alerts for a user or their caretaker."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """SELECT * FROM alerts
           WHERE user_id = %s OR caretaker_id = %s
           ORDER BY created_at DESC
           LIMIT %s""",
        (user_id, user_id, limit)
    )
    alerts = cursor.fetchall()
    for a in alerts:
        if a.get('created_at'):
            a['time_ago'] = format_time_ago(a['created_at'])
            a['created_at'] = str(a['created_at'])
    cursor.close()
    conn.close()
    return alerts


def mark_alert_read(alert_id, user_id):
    """Mark an alert as read."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE alerts SET is_read = TRUE WHERE id = %s AND (user_id = %s OR caretaker_id = %s)",
        (alert_id, user_id, user_id)
    )
    conn.commit()
    cursor.close()
    conn.close()
