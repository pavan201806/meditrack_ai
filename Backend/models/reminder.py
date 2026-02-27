from database.schema import get_connection
from datetime import datetime, date, timedelta


def create_reminder(user_id, medicine_id, scheduled_time, voice_enabled=True):
    """Create a new reminder."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO reminders (user_id, medicine_id, scheduled_time, voice_enabled)
           VALUES (%s, %s, %s, %s)""",
        (user_id, medicine_id, scheduled_time, voice_enabled)
    )
    conn.commit()
    reminder_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return reminder_id


def get_reminders(user_id):
    """Get upcoming and completed reminders for a user."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    # Upcoming
    cursor.execute("""
        SELECT r.*, m.name as medicine_name, m.dosage, m.instruction, m.icon, m.pill_count, m.type
        FROM reminders r
        JOIN medicines m ON r.medicine_id = m.id
        WHERE r.user_id = %s AND r.status IN ('upcoming', 'snoozed')
        ORDER BY r.scheduled_time ASC
    """, (user_id,))
    upcoming = cursor.fetchall()

    # Completed (today)
    cursor.execute("""
        SELECT r.*, m.name as medicine_name, m.dosage, m.instruction, m.icon, m.pill_count, m.type
        FROM reminders r
        JOIN medicines m ON r.medicine_id = m.id
        WHERE r.user_id = %s AND r.status = 'completed'
              AND DATE(r.scheduled_time) = CURDATE()
        ORDER BY r.scheduled_time DESC
    """, (user_id,))
    completed = cursor.fetchall()

    for r in upcoming + completed:
        if r.get('scheduled_time'):
            r['scheduled_time'] = str(r['scheduled_time'])
        if r.get('snooze_until'):
            r['snooze_until'] = str(r['snooze_until'])
        if r.get('created_at'):
            r['created_at'] = str(r['created_at'])

    cursor.close()
    conn.close()
    return {'upcoming': upcoming, 'completed': completed}


# Alias for backward compatibility
def get_reminders_by_user(user_id, status=None):
    """Get reminders for a user, optionally filtered by status."""
    data = get_reminders(user_id)
    if status == 'upcoming':
        return data['upcoming']
    elif status == 'completed':
        return data['completed']
    return data['upcoming'] + data['completed']


def take_reminder(reminder_id, user_id):
    """Mark a reminder as taken/completed."""
    return update_reminder_status(reminder_id, user_id, 'completed')


def snooze_reminder(reminder_id, user_id, minutes=10):
    """Snooze a reminder for N minutes."""
    snooze_until = datetime.now() + timedelta(minutes=minutes)
    return update_reminder_status(reminder_id, user_id, 'snoozed', snooze_until)


def update_reminder_status(reminder_id, user_id, status, snooze_until=None):
    """Update reminder status (completed, snoozed, etc)."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE reminders SET status = %s, snooze_until = %s WHERE id = %s AND user_id = %s",
        (status, snooze_until, reminder_id, user_id)
    )
    conn.commit()
    affected = cursor.rowcount
    cursor.close()
    conn.close()
    return affected > 0
