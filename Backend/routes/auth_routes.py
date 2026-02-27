from flask import Blueprint, request
from flask_bcrypt import Bcrypt
from models.user import create_user, find_user_by_email
from utils.auth_middleware import generate_token
from utils.helpers import success_response, error_response

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')
bcrypt = Bcrypt()


@auth_bp.route('/signup', methods=['POST'])
def signup():
    """Register a new user."""
    data = request.get_json()

    # Validation
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    phone = data.get('phone', '').strip()
    password = data.get('password', '')
    role = data.get('role', 'patient')

    if not name or not email or not password:
        return error_response('Name, email, and password are required')

    if len(password) < 6:
        return error_response('Password must be at least 6 characters')

    if role not in ('patient', 'caretaker'):
        return error_response('Role must be patient or caretaker')

    # Check if user exists
    existing = find_user_by_email(email)
    if existing:
        return error_response('An account with this email already exists', 409)

    # Hash password and create user
    password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
    user_id = create_user(name, email, phone if phone else None, password_hash, role)

    # Generate token
    token = generate_token(user_id, email, role)

    return success_response({
        'token': token,
        'user': {
            'id': user_id,
            'name': name,
            'email': email,
            'phone': phone if phone else None,
            'role': role,
        }
    }, 'Account created successfully', 201)


@auth_bp.route('/login', methods=['POST'])
def login():
    """Login with email and password."""
    data = request.get_json()

    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return error_response('Email and password are required')

    # Find user
    user = find_user_by_email(email)
    if not user:
        return error_response('Invalid email or password', 401)

    # Verify password
    if not bcrypt.check_password_hash(user['password_hash'], password):
        return error_response('Invalid email or password', 401)

    # Generate token
    token = generate_token(user['id'], user['email'], user['role'])

    return success_response({
        'token': token,
        'user': {
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
            'phone': user.get('phone'),
            'role': user['role'],
        }
    }, 'Login successful')
