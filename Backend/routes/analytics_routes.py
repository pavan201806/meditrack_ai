from flask import Blueprint, request
from utils.auth_middleware import token_required
from utils.helpers import success_response, error_response
from models.dose_log import get_adherence_stats, get_medication_breakdown
from ml.ai_insights import generate_insight
from ml.adherence_model import get_risk_score, get_monthly_breakdown

analytics_bp = Blueprint('analytics', __name__, url_prefix='/api/analytics')


@analytics_bp.route('', methods=['GET'])
@token_required
def get_analytics():
    """Get adherence analytics (default 7 days)."""
    days = request.args.get('days', 7, type=int)

    stats = get_adherence_stats(request.user_id, days)
    breakdown = get_medication_breakdown(request.user_id, days)
    from models.dose_log import get_streak
    streak = get_streak(request.user_id)

    stats['currentStreak'] = streak
    stats['totalDoses'] = stats['total']
    stats['medicationBreakdown'] = breakdown

    return success_response(stats)


@analytics_bp.route('/insights', methods=['GET'])
@token_required
def get_insights():
    """Get AI-generated insights."""
    insight = generate_insight(request.user_id)
    return success_response(insight)


@analytics_bp.route('/risk', methods=['GET'])
@token_required
def get_risk():
    """Get predictive risk score for missed doses."""
    risk = get_risk_score(request.user_id)
    return success_response(risk)


@analytics_bp.route('/monthly', methods=['GET'])
@token_required
def get_monthly():
    """Get 30-day daily adherence breakdown."""
    daily = get_monthly_breakdown(request.user_id)
    stats = get_adherence_stats(request.user_id, 30)
    return success_response({
        'daily': daily,
        'summary': stats,
    })
