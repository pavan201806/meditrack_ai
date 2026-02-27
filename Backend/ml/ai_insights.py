"""
Enhanced AI Insights Generator.
Analyzes adherence patterns, time-of-day trends, and generates natural language recommendations.
"""
from database.schema import get_connection
from datetime import date, timedelta


def generate_insight(user_id):
    """Generate personalized AI insight based on adherence patterns."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    # Get last 14 days of dose data
    start_date = date.today() - timedelta(days=14)
    cursor.execute("""
        SELECT dl.status, dl.dose_date, dl.scheduled_time,
               m.name as medicine_name
        FROM dose_logs dl
        JOIN medicines m ON dl.medicine_id = m.id
        WHERE dl.user_id = %s AND dl.dose_date >= %s
        ORDER BY dl.dose_date DESC
    """, (user_id, start_date))
    logs = cursor.fetchall()

    # Get behavior data
    cursor.execute("""
        SELECT rb.*, m.name as medicine_name
        FROM reminder_behavior rb
        JOIN medicines m ON rb.medicine_id = m.id
        WHERE rb.user_id = %s
    """, (user_id,))
    behaviors = cursor.fetchall()

    cursor.close()
    conn.close()

    if not logs:
        return {
            'aiInsight': "Welcome to MediTrack AI! Start logging your doses to receive personalized insights and recommendations.",
            'tips': [
                'Set consistent times for your medications',
                'Use the QR scanner for quick dose logging',
                'Enable voice reminders for hands-free notifications',
            ],
        }

    total = len(logs)
    taken = sum(1 for l in logs if l['status'] == 'taken')
    missed = sum(1 for l in logs if l['status'] == 'missed')
    pct = round(taken / total * 100, 1) if total else 0

    # Time-of-day analysis
    morning_logs = [l for l in logs if l.get('scheduled_time', '') < '12:00']
    evening_logs = [l for l in logs if l.get('scheduled_time', '') >= '17:00']
    morning_taken = sum(1 for l in morning_logs if l['status'] == 'taken')
    evening_taken = sum(1 for l in evening_logs if l['status'] == 'taken')
    morning_rate = round(morning_taken / max(len(morning_logs), 1) * 100)
    evening_rate = round(evening_taken / max(len(evening_logs), 1) * 100)

    # Medicine-specific analysis
    med_stats = {}
    for l in logs:
        mn = l.get('medicine_name', 'Unknown')
        if mn not in med_stats:
            med_stats[mn] = {'taken': 0, 'total': 0}
        med_stats[mn]['total'] += 1
        if l['status'] == 'taken':
            med_stats[mn]['taken'] += 1

    worst_med = None
    worst_rate = 100
    for mn, stats in med_stats.items():
        rate = (stats['taken'] / stats['total'] * 100) if stats['total'] else 100
        if rate < worst_rate:
            worst_rate = rate
            worst_med = mn

    # Generate insight text
    insights = []

    if pct >= 90:
        insights.append(f"Excellent work! Your adherence is at {pct}% over the past 2 weeks.")
    elif pct >= 70:
        insights.append(f"Good progress! Your adherence is {pct}%. Let's aim for 90%+.")
    else:
        insights.append(f"Your adherence is {pct}%. Regular medication is crucial for your health.")

    if morning_rate > evening_rate + 15:
        insights.append(f"You're more consistent with morning doses ({morning_rate}%) vs evening ({evening_rate}%). Consider setting a dinner-time alarm.")
    elif evening_rate > morning_rate + 15:
        insights.append(f"Evening doses ({evening_rate}%) are better than morning doses ({morning_rate}%). Try placing morning medicine near your alarm clock.")

    if worst_med and worst_rate < 80:
        insights.append(f"{worst_med} has the lowest adherence at {round(worst_rate)}%. Focus on this medication.")

    # Tips based on behavior
    tips = []
    total_snooze = sum(b.get('snooze_count', 0) for b in behaviors)
    avg_delay = sum(b.get('avg_delay_mins', 0) for b in behaviors) / max(len(behaviors), 1)

    if total_snooze > 5:
        tips.append("You snooze reminders frequently. Try placing medicine where you'll see it.")
    if avg_delay > 15:
        tips.append(f'You tend to take doses {int(avg_delay)} minutes late. Adjust reminder times to match your routine.')
    if missed > 3:
        tips.append('Enable QR scanning for faster dose confirmation.')

    tips.append('Consistency is key — try to take medications at the same time daily.')

    return {
        'aiInsight': ' '.join(insights),
        'tips': tips,
        'stats': {
            'adherence_2w': pct,
            'morning_rate': morning_rate,
            'evening_rate': evening_rate,
            'worst_medicine': worst_med,
            'worst_rate': round(worst_rate),
        },
    }
