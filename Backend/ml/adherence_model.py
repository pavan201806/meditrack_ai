"""
Enhanced Adherence Prediction Model.
Predicts missed dose risk, identifies risk factors, trend analysis.
"""
import random
from datetime import datetime, timedelta, date
from database.schema import get_connection

try:
    import numpy as np
    from sklearn.ensemble import RandomForestClassifier
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False


def get_risk_score(user_id):
    """
    Calculate predictive risk score for next 24h missed dose probability.
    Returns risk percentage + risk factors.
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    # Get last 30 days of dose data
    start = date.today() - timedelta(days=30)
    cursor.execute("""
        SELECT status, dose_date, scheduled_time
        FROM dose_logs WHERE user_id = %s AND dose_date >= %s
        ORDER BY dose_date DESC
    """, (user_id, start))
    logs = cursor.fetchall()

    # Get behavior data
    cursor.execute("""
        SELECT miss_count, snooze_count, avg_delay_mins, total_events
        FROM reminder_behavior WHERE user_id = %s
    """, (user_id,))
    behaviors = cursor.fetchall()

    cursor.close()
    conn.close()

    if not logs:
        return {
            'risk_score': 15,
            'risk_level': 'low',
            'risk_factors': [],
            'trend': 'stable',
            'prediction': 'Not enough data for accurate prediction',
        }

    # Calculate metrics
    total = len(logs)
    taken = sum(1 for l in logs if l['status'] == 'taken')
    missed = sum(1 for l in logs if l['status'] == 'missed')
    adherence_pct = (taken / total * 100) if total > 0 else 100

    # Recent trend (last 7 days vs previous 7 days)
    week1_start = date.today() - timedelta(days=7)
    week2_start = date.today() - timedelta(days=14)
    recent = [l for l in logs if l['dose_date'] >= week1_start]
    older = [l for l in logs if week2_start <= l['dose_date'] < week1_start]

    recent_rate = sum(1 for l in recent if l['status'] == 'taken') / max(len(recent), 1) * 100
    older_rate = sum(1 for l in older if l['status'] == 'taken') / max(len(older), 1) * 100
    trend_diff = recent_rate - older_rate
    trend = 'improving' if trend_diff > 5 else 'declining' if trend_diff < -5 else 'stable'

    # Risk factors
    risk_factors = []
    total_miss = sum(b.get('miss_count', 0) for b in behaviors)
    total_snooze = sum(b.get('snooze_count', 0) for b in behaviors)
    avg_delay = sum(b.get('avg_delay_mins', 0) for b in behaviors) / max(len(behaviors), 1)

    if missed > 3:
        risk_factors.append(f'{missed} missed doses in last 30 days')
    if total_snooze > 5:
        risk_factors.append(f'Frequent snoozing ({total_snooze} times)')
    if avg_delay > 20:
        risk_factors.append(f'Average delay of {int(avg_delay)} minutes')
    if trend == 'declining':
        risk_factors.append('Adherence trend is declining')

    # Time-of-day patterns
    evening_missed = sum(1 for l in logs
                         if l['status'] == 'missed' and l.get('scheduled_time', '12:00') >= '17:00')
    morning_missed = sum(1 for l in logs
                         if l['status'] == 'missed' and l.get('scheduled_time', '12:00') < '12:00')
    if evening_missed > morning_missed and evening_missed > 2:
        risk_factors.append('Evening doses are most frequently missed')
    elif morning_missed > 2:
        risk_factors.append('Morning doses are most frequently missed')

    # Calculate risk score (0-100)
    base_risk = 100 - adherence_pct
    behavior_penalty = min(total_miss * 2 + total_snooze, 20)
    trend_mod = -10 if trend == 'improving' else 10 if trend == 'declining' else 0
    risk_score = max(0, min(100, int(base_risk + behavior_penalty + trend_mod)))

    risk_level = 'low' if risk_score < 25 else 'medium' if risk_score < 50 else 'high'

    return {
        'risk_score': risk_score,
        'risk_level': risk_level,
        'risk_factors': risk_factors,
        'trend': trend,
        'trend_detail': f'{trend_diff:+.1f}% vs last week',
        'adherence_30d': round(adherence_pct, 1),
        'prediction': f"{'Low' if risk_score < 25 else 'Moderate' if risk_score < 50 else 'High'} probability of missing doses in next 24 hours.",
    }


def get_monthly_breakdown(user_id):
    """Get daily adherence for past 30 days."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    start = date.today() - timedelta(days=29)

    cursor.execute("""
        SELECT dose_date,
               COUNT(*) as total,
               SUM(CASE WHEN status = 'taken' THEN 1 ELSE 0 END) as taken
        FROM dose_logs
        WHERE user_id = %s AND dose_date >= %s
        GROUP BY dose_date ORDER BY dose_date ASC
    """, (user_id, start))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    daily = []
    for row in rows:
        d = row['dose_date']
        if isinstance(d, str):
            d = datetime.strptime(d, '%Y-%m-%d').date()
        t = row['total'] or 1
        tk = int(row['taken'] or 0)
        daily.append({
            'date': str(d),
            'day': d.strftime('%d'),
            'adherence': round(tk / t * 100),
        })

    return daily
