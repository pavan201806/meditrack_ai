from database.schema import get_connection
from datetime import datetime, date, timedelta


def log_dose(user_id, medicine_id, scheduled_time, status='taken', dose_date=None):
    """Log a dose as taken or missed."""
    conn = get_connection()
    cursor = conn.cursor()
    d = dose_date or date.today()
    taken_at = datetime.utcnow() if status == 'taken' else None

    # Upsert: update if exists for same date+medicine+time, else insert
    cursor.execute(
        """INSERT INTO dose_logs (user_id, medicine_id, scheduled_time, taken_at, status, dose_date)
           VALUES (%s, %s, %s, %s, %s, %s)
           ON DUPLICATE KEY UPDATE status = VALUES(status), taken_at = VALUES(taken_at)""",
        (user_id, medicine_id, scheduled_time, taken_at, status, d)
    )
    conn.commit()
    log_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return log_id


def get_today_doses(user_id):
    """Get all dose logs for today."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """SELECT dl.*, m.name as medicine_name, m.dosage, m.instruction, m.icon, m.type
           FROM dose_logs dl
           JOIN medicines m ON dl.medicine_id = m.id
           WHERE dl.user_id = %s AND dl.dose_date = CURDATE()
           ORDER BY dl.scheduled_time ASC""",
        (user_id,)
    )
    doses = cursor.fetchall()
    for d in doses:
        if d.get('taken_at'):
            d['taken_at'] = str(d['taken_at'])
        if d.get('dose_date'):
            d['dose_date'] = str(d['dose_date'])
        if d.get('created_at'):
            d['created_at'] = str(d['created_at'])
    cursor.close()
    conn.close()
    return doses


def get_adherence_stats(user_id, days=7):
    """Calculate adherence statistics for the given number of days."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    start_date = date.today() - timedelta(days=days - 1)

    # Total and taken counts
    cursor.execute(
        """SELECT
             COUNT(*) as total,
             SUM(CASE WHEN status = 'taken' THEN 1 ELSE 0 END) as taken,
             SUM(CASE WHEN status = 'missed' THEN 1 ELSE 0 END) as missed
           FROM dose_logs
           WHERE user_id = %s AND dose_date >= %s""",
        (user_id, start_date)
    )
    stats = cursor.fetchone()

    total = stats['total'] or 0
    taken = int(stats['taken'] or 0)
    missed = int(stats['missed'] or 0)
    percentage = round((taken / total * 100) if total > 0 else 0, 1)

    # Daily breakdown for chart
    cursor.execute(
        """SELECT
             dose_date,
             COUNT(*) as total,
             SUM(CASE WHEN status = 'taken' THEN 1 ELSE 0 END) as taken
           FROM dose_logs
           WHERE user_id = %s AND dose_date >= %s
           GROUP BY dose_date
           ORDER BY dose_date ASC""",
        (user_id, start_date)
    )
    daily = cursor.fetchall()

    day_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    weekly_adherence = []
    for row in daily:
        d = row['dose_date']
        if isinstance(d, str):
            d = datetime.strptime(d, '%Y-%m-%d').date()
        day_name = day_names[d.weekday()]
        day_total = row['total'] or 1
        day_taken = int(row['taken'] or 0)
        day_pct = round(day_taken / day_total * 100)
        weekly_adherence.append({'day': day_name, 'value': day_pct})

    cursor.close()
    conn.close()

    return {
        'total': total,
        'taken': taken,
        'missed': missed,
        'adherencePercentage': percentage,
        'weeklyAdherence': weekly_adherence,
    }


def get_streak(user_id):
    """Calculate the current adherence streak (consecutive days with all doses taken)."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute(
        """SELECT dose_date,
                  COUNT(*) as total,
                  SUM(CASE WHEN status = 'taken' THEN 1 ELSE 0 END) as taken
           FROM dose_logs
           WHERE user_id = %s
           GROUP BY dose_date
           ORDER BY dose_date DESC
           LIMIT 60""",
        (user_id,)
    )
    days = cursor.fetchall()
    cursor.close()
    conn.close()

    streak = 0
    for day in days:
        if int(day['taken'] or 0) == int(day['total'] or 0) and day['total'] > 0:
            streak += 1
        else:
            break

    return streak


def get_medication_breakdown(user_id, days=7):
    """Get adherence percentage per medicine."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    start_date = date.today() - timedelta(days=days - 1)

    cursor.execute(
        """SELECT m.name, m.color,
                  COUNT(dl.id) as total,
                  SUM(CASE WHEN dl.status = 'taken' THEN 1 ELSE 0 END) as taken
           FROM medicines m
           LEFT JOIN dose_logs dl ON m.id = dl.medicine_id AND dl.dose_date >= %s
           WHERE m.user_id = %s AND m.is_active = TRUE
           GROUP BY m.id, m.name, m.color""",
        (start_date, user_id)
    )
    breakdown = cursor.fetchall()

    result = []
    for med in breakdown:
        total = med['total'] or 0
        taken = int(med['taken'] or 0)
        pct = round(taken / total * 100) if total > 0 else 0
        result.append({
            'name': med['name'],
            'adherence': pct,
            'color': med['color'],
        })

    cursor.close()
    conn.close()
    return result
