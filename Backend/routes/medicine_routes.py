from flask import Blueprint, request
from utils.auth_middleware import token_required
from utils.helpers import success_response, error_response
from models.medicine import get_medicines_by_user, create_medicine, get_medicine_by_id, update_medicine, delete_medicine
from ml.drug_interactions import check_new_medicine
from database.schema import get_connection

medicine_bp = Blueprint('medicines', __name__, url_prefix='/api/medicines')


@medicine_bp.route('', methods=['GET'])
@token_required
def list_medicines():
    """Get all active medicines for the user."""
    medicines = get_medicines_by_user(request.user_id)
    return success_response(medicines)


@medicine_bp.route('', methods=['POST'])
@token_required
def add_medicine():
    """Add a new medicine. Auto-checks drug interactions."""
    data = request.get_json()
    name = data.get('name', '').strip()
    dosage = data.get('dosage', '').strip()

    if not name or not dosage:
        return error_response('Name and dosage are required')

    # Auto-check interactions before adding
    existing = get_medicines_by_user(request.user_id)
    existing_names = [m['name'] for m in existing]
    interactions = check_new_medicine(name, existing_names)

    medicine_id = create_medicine(
        user_id=request.user_id, name=name, dosage=dosage,
        med_type=data.get('type', 'Oral Tablet'),
        quantity=data.get('quantity', '30 Tabs'),
        frequency=data.get('frequency', 'Once daily'),
        instruction=data.get('instruction', ''),
        notes=data.get('notes', ''),
        color=data.get('color', '#4CAF50'),
        icon=data.get('icon', 'pill'),
        pill_count=data.get('pill_count', 1),
        schedules=data.get('schedules', []),
    )

    # Set initial pills_remaining
    conn = get_connection()
    cursor = conn.cursor()
    pills_qty = int(data.get('pills_remaining', 30))
    cursor.execute("UPDATE medicines SET pills_remaining = %s WHERE id = %s", (pills_qty, medicine_id))
    conn.commit()
    cursor.close()
    conn.close()

    result = {'medicine_id': medicine_id}
    if interactions:
        result['interactions'] = interactions
        result['has_severe_interaction'] = any(i['severity'] == 'severe' for i in interactions)

    return success_response(result, 'Medicine added', 201)


@medicine_bp.route('/<int:medicine_id>', methods=['GET'])
@token_required
def get_medicine(medicine_id):
    """Get medicine details."""
    med = get_medicine_by_id(medicine_id, request.user_id)
    if not med:
        return error_response('Medicine not found', 404)
    return success_response(med)


@medicine_bp.route('/<int:medicine_id>', methods=['PUT'])
@token_required
def edit_medicine(medicine_id):
    """Update a medicine."""
    data = request.get_json()
    update_medicine(medicine_id, request.user_id, **data)
    return success_response(None, 'Medicine updated')


@medicine_bp.route('/<int:medicine_id>', methods=['DELETE'])
@token_required
def remove_medicine(medicine_id):
    """Soft delete a medicine."""
    success = delete_medicine(medicine_id, request.user_id)
    if not success:
        return error_response('Medicine not found', 404)
    return success_response(None, 'Medicine removed')


@medicine_bp.route('/refills', methods=['GET'])
@token_required
def get_refills():
    """Get medicines that need refill (pills_remaining < 5)."""
    medicines = get_medicines_by_user(request.user_id)
    refills = []
    for med in medicines:
        remaining = med.get('pills_remaining', 30)
        if remaining is not None and remaining <= 5:
            refills.append({
                'id': med['id'],
                'name': med['name'],
                'dosage': med['dosage'],
                'pills_remaining': remaining,
                'urgent': remaining <= 2,
            })
    return success_response({
        'refills': refills,
        'count': len(refills),
    })
