from flask import Blueprint, request
from utils.auth_middleware import token_required
from utils.helpers import success_response, error_response
from ml.drug_interactions import check_interactions, check_new_medicine
from models.medicine import get_medicines_by_user

interaction_bp = Blueprint('interaction', __name__, url_prefix='/api/interactions')


@interaction_bp.route('/check', methods=['POST'])
@token_required
def check_user_interactions():
    """Check drug interactions for user's current medicines."""
    data = request.get_json() or {}

    # If specific names provided, check those. Otherwise check all user medicines.
    names = data.get('medicine_names')
    if not names:
        medicines = get_medicines_by_user(request.user_id)
        names = [m['name'] for m in medicines]

    if len(names) < 2:
        return success_response({'interactions': [], 'count': 0}, 'Need at least 2 medicines to check')

    interactions = check_interactions(names)
    return success_response({
        'interactions': interactions,
        'count': len(interactions),
        'has_severe': any(i['severity'] == 'severe' for i in interactions),
    })


@interaction_bp.route('/check-new', methods=['POST'])
@token_required
def check_new():
    """Check interactions when adding a new medicine."""
    data = request.get_json()
    new_name = data.get('medicine_name', '').strip()
    if not new_name:
        return error_response('Medicine name is required')

    medicines = get_medicines_by_user(request.user_id)
    existing = [m['name'] for m in medicines]

    interactions = check_new_medicine(new_name, existing)
    return success_response({
        'interactions': interactions,
        'count': len(interactions),
        'has_severe': any(i['severity'] == 'severe' for i in interactions),
        'safe_to_add': not any(i['severity'] == 'severe' for i in interactions),
    })
