from flask import Blueprint, request
from utils.auth_middleware import token_required
from utils.helpers import success_response, error_response
from ml.ocr_scanner import scan_prescription, KNOWN_MEDICINES
from models.medicine import create_medicine

scanner_bp = Blueprint('scanner', __name__, url_prefix='/api/scanner')


@scanner_bp.route('/scan', methods=['POST'])
@token_required
def scan():
    """Scan prescription image. Returns multiple medicines with confidence."""
    image_data = None

    if 'image' in request.files:
        file = request.files['image']
        image_data = file.read()
    elif request.is_json:
        import base64
        data = request.get_json()
        b64 = data.get('image', '')
        if b64:
            try:
                image_data = base64.b64decode(b64)
            except Exception:
                return error_response('Invalid base64 image data')

    result = scan_prescription(image_data)
    return success_response(result, 'Prescription scanned')


@scanner_bp.route('/validate', methods=['POST'])
@token_required
def validate_scan():
    """Validate and correct scanned medicine fields."""
    data = request.get_json()
    medicines = data.get('medicines', [])

    validated = []
    for med in medicines:
        name = med.get('name', '').strip()
        name_lower = name.lower()

        # Check if known medicine
        known = KNOWN_MEDICINES.get(name_lower)
        if known:
            med['type'] = known['type']
            med['icon'] = known.get('icon', 'pill')
            med['category'] = known.get('category', 'unknown')
            med['name_valid'] = True
        else:
            med['name_valid'] = False

        # Validate dosage format
        med['dosage_valid'] = bool(med.get('dosage')) and any(
            u in med['dosage'].lower() for u in ['mg', 'mcg', 'g', 'ml', 'iu']
        )

        # Validate frequency
        valid_freqs = ['Once daily', 'Twice daily', 'Three times daily', 'Four times daily',
                       'Once weekly', 'As needed', 'Every few hours']
        med['frequency_valid'] = med.get('frequency', '') in valid_freqs

        validated.append(med)

    return success_response({'medicines': validated}, 'Validation complete')


@scanner_bp.route('/confirm', methods=['POST'])
@token_required
def confirm_scan():
    """Confirm single scanned medicine and add to user's medicines."""
    data = request.get_json()
    name = data.get('name', '').strip()
    dosage = data.get('dosage', '').strip()

    if not name or not dosage:
        return error_response('Medicine name and dosage are required')

    medicine_id = create_medicine(
        user_id=request.user_id, name=name, dosage=dosage,
        med_type=data.get('type', 'Oral Tablet'),
        quantity=data.get('quantity', '30 Tabs'),
        frequency=data.get('frequency', 'Once daily'),
        instruction=data.get('timing', data.get('instruction', '')),
        notes=data.get('notes', 'Added via prescription scan'),
        color=data.get('color', '#4CAF50'),
        icon=data.get('icon', 'pill'),
        pill_count=data.get('pillCount', 1),
        schedules=data.get('schedules', []),
    )
    return success_response({'medicine_id': medicine_id}, 'Medicine added from scan', 201)


@scanner_bp.route('/confirm-batch', methods=['POST'])
@token_required
def confirm_batch():
    """Confirm multiple scanned medicines at once."""
    data = request.get_json()
    medicines = data.get('medicines', [])

    if not medicines:
        return error_response('No medicines to add')

    added = []
    for med in medicines:
        name = med.get('name', '').strip()
        dosage = med.get('dosage', '').strip()
        if not name or not dosage:
            continue

        mid = create_medicine(
            user_id=request.user_id, name=name, dosage=dosage,
            med_type=med.get('type', 'Oral Tablet'),
            quantity=med.get('quantity', '30 Tabs'),
            frequency=med.get('frequency', 'Once daily'),
            instruction=med.get('timing', med.get('instruction', '')),
            notes=med.get('notes', 'Added via prescription scan'),
            color=med.get('color', '#4CAF50'),
            icon=med.get('icon', 'pill'),
            pill_count=med.get('pillCount', 1),
            schedules=med.get('schedules', []),
        )
        added.append({'medicine_id': mid, 'name': name})

    return success_response({'added': added, 'count': len(added)}, f'{len(added)} medicines added', 201)
