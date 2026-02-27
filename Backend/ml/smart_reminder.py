"""
Smart Reminder Engine.
Adaptive scheduling based on user behavior patterns.
Escalation alerts and emergency triggers.
"""
from database.schema import get_connection
from models.alert import create_alert
from datetime import datetime, timedelta


def track_behavior(user_id, medicine_id, event_type, delay_mins=0):
    """Track reminder behavior (miss, snooze, late take)."""
    conn = get_connection()
    cursor = conn.cursor()

    # Upsert behavior record
    cursor.execute("""
        INSERT INTO reminder_behavior (user_id, medicine_id, miss_count, snooze_count, avg_delay_mins, total_events)
        VALUES (%s, %s, %s, %s, %s, 1)
        ON DUPLICATE KEY UPDATE
            miss_count = miss_count + IF(%s = 'miss', 1, 0),
            snooze_count = snooze_count + IF(%s = 'snooze', 1, 0),
            avg_delay_mins = (avg_delay_mins * total_events + %s) / (total_events + 1),
            total_events = total_events + 1,
            last_updated = CURRENT_TIMESTAMP
    """, (
        user_id, medicine_id,
        1 if event_type == 'miss' else 0,
        1 if event_type == 'snooze' else 0,
        delay_mins,
        event_type, event_type, delay_mins,
    ))
    conn.commit()

    # Check for escalation
    cursor.execute("""
        SELECT miss_count, snooze_count FROM reminder_behavior
        WHERE user_id = %s AND medicine_id = %s
    """, (user_id, medicine_id))
    row = cursor.fetchone()

    if row:
        miss_count = row[0] or 0
        snooze_count = row[1] or 0

        # Escalation: 3+ consecutive misses
        if miss_count >= 3 and miss_count % 3 == 0:
            create_alert(
                user_id=user_id,
                alert_type='error',
                title='Critical: Repeated Missed Doses',
                description=f'You have missed {miss_count} doses. Please take your medication or consult your doctor.',
                caretaker_id=None,
            )

        # Emergency: 5+ consecutive misses
        if miss_count >= 5 and miss_count % 5 == 0:
            # Notify caretakers
            cursor.execute("""
                SELECT caretaker_id FROM caretaker_patients WHERE patient_id = %s
            """, (user_id,))
            caretakers = cursor.fetchall()
            for (ct_id,) in caretakers:
                create_alert(
                    user_id=user_id,
                    alert_type='error',
                    title='Emergency: Non-Compliance Alert',
                    description=f'Patient has missed {miss_count} doses of medication. Immediate attention needed.',
                    caretaker_id=ct_id,
                )

    cursor.close()
    conn.close()


def get_adaptive_schedule(user_id):
    """Generate adaptive schedule suggestions based on behavior."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT rb.*, m.name as medicine_name, m.frequency,
               GROUP_CONCAT(ms.time) as schedule_times
        FROM reminder_behavior rb
        JOIN medicines m ON rb.medicine_id = m.id
        LEFT JOIN medicine_schedules ms ON m.id = ms.medicine_id
        WHERE rb.user_id = %s AND m.is_active = TRUE
        GROUP BY rb.id
    """, (user_id,))
    behaviors = cursor.fetchall()

    suggestions = []
    for b in behaviors:
        avg_delay = b.get('avg_delay_mins', 0) or 0
        miss_pct = 0
        if b.get('total_events', 0) > 0:
            miss_pct = (b.get('miss_count', 0) / b['total_events']) * 100

        suggestion = {
            'medicine': b['medicine_name'],
            'current_times': b.get('schedule_times', '').split(',') if b.get('schedule_times') else [],
            'miss_rate': round(miss_pct, 1),
            'avg_delay': round(avg_delay),
            'risk_level': 'high' if miss_pct > 30 else 'medium' if miss_pct > 15 else 'low',
        }

        # Suggest time shift if consistently late
        if avg_delay > 15:
            suggestion['recommendation'] = f'Consider shifting reminder {int(avg_delay)}min later to match your pattern.'
            suggestion['suggested_shift_mins'] = int(avg_delay)

        # Suggest extra reminder if high miss rate
        if miss_pct > 25:
            suggestion['recommendation'] = 'Add a pre-reminder 15 minutes before scheduled time.'
            suggestion['add_pre_reminder'] = True

        suggestions.append(suggestion)

    cursor.close()
    conn.close()
    return suggestions
