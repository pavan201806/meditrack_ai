"""
MediTrack AI - Flask Backend (Enhanced)
========================================
AI-powered Medication Adherence System.
Auto-creates all database tables on startup.

Usage:
    1. Update .env with your MySQL credentials
    2. pip install -r requirements.txt
    3. python app.py
"""
import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_bcrypt import Bcrypt

from config import Config
from database.schema import init_db

# Import route blueprints
from routes.auth_routes import auth_bp, bcrypt as auth_bcrypt
from routes.medicine_routes import medicine_bp
from routes.reminder_routes import reminder_bp
from routes.dose_routes import dose_bp
from routes.dashboard_routes import dashboard_bp
from routes.analytics_routes import analytics_bp
from routes.scanner_routes import scanner_bp
from routes.caretaker_routes import caretaker_bp
from routes.health_routes import health_bp
from routes.interaction_routes import interaction_bp
from routes.qr_routes import qr_bp


def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__)
    app.config['SECRET_KEY'] = Config.SECRET_KEY
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload

    # Enable CORS for all routes (for Expo app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Initialize Bcrypt
    auth_bcrypt.init_app(app)

    # Register all blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(medicine_bp)
    app.register_blueprint(reminder_bp)
    app.register_blueprint(dose_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(scanner_bp)
    app.register_blueprint(caretaker_bp)
    app.register_blueprint(health_bp)
    app.register_blueprint(interaction_bp)
    app.register_blueprint(qr_bp)

    # Health check endpoint
    @app.route('/')
    def index():
        return jsonify({
            'app': 'MediTrack AI Backend',
            'version': '2.0.0',
            'status': 'running',
            'endpoints': {
                'auth': '/api/auth/login, /api/auth/signup',
                'medicines': '/api/medicines, /api/medicines/refills',
                'reminders': '/api/reminders, /api/reminders/adaptive',
                'doses': '/api/doses/log, /api/doses/today',
                'dashboard': '/api/dashboard',
                'analytics': '/api/analytics, /api/analytics/insights, /api/analytics/risk, /api/analytics/monthly',
                'scanner': '/api/scanner/scan, /api/scanner/confirm, /api/scanner/confirm-batch, /api/scanner/validate',
                'qr': '/api/qr/generate/:id, /api/qr/scan',
                'interactions': '/api/interactions/check, /api/interactions/check-new',
                'caretaker': '/api/caretaker/patients, /api/caretaker/alerts, /api/caretaker/report/:id',
                'health': '/api/health/log, /api/health/today',
            }
        })

    # Error handlers
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'success': False, 'error': 'Endpoint not found'}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

    return app


if __name__ == '__main__':
    print("🚀 Starting MediTrack AI Backend v2.0...")
    print("📦 Initializing database tables...")

    # Auto-create all tables
    try:
        init_db()
    except Exception as e:
        print(f"⚠️  Database connection failed: {e}")
        print("   Make sure to update .env with your MySQL credentials.")
        print("   The server will start anyway, but DB operations will fail.\n")

    app = create_app()
    print(f"\n✅ Server running at http://0.0.0.0:5001")
    print("📋 Visit http://localhost:5001 for API documentation\n")
    app.run(host='0.0.0.0', port=5001, debug=True)
