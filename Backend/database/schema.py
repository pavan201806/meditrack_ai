import mysql.connector
import time
from config import Config


def get_connection(retries=3, delay=1):
    """Get a MySQL database connection with retry logic for cloud DB."""
    last_err = None
    cfg = Config.get_db_config()
    cfg['connection_timeout'] = 10
    for attempt in range(retries):
        try:
            return mysql.connector.connect(**cfg)
        except mysql.connector.errors.DatabaseError as e:
            last_err = e
            if attempt < retries - 1:
                time.sleep(delay)
    raise last_err


def init_db():
    """Create database and all tables automatically on startup."""
    # First connect without database to create it if needed
    conn = mysql.connector.connect(
        host=Config.DB_HOST,
        port=Config.DB_PORT,
        user=Config.DB_USER,
        password=Config.DB_PASSWORD,
    )
    cursor = conn.cursor()
    cursor.execute(f"CREATE DATABASE IF NOT EXISTS {Config.DB_NAME}")
    cursor.close()
    conn.close()

    # Now connect to the database and create tables
    conn = get_connection()
    cursor = conn.cursor()

    tables = [
        # Users table
        """
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(150) UNIQUE NOT NULL,
            phone VARCHAR(20) NULL,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('patient', 'caretaker', 'admin') DEFAULT 'patient',
            avatar_url VARCHAR(500) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
        """,

        # Medicines table (enhanced with QR, refill tracking)
        """
        CREATE TABLE IF NOT EXISTS medicines (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            name VARCHAR(200) NOT NULL,
            dosage VARCHAR(50) NOT NULL,
            type VARCHAR(50) DEFAULT 'Oral Tablet',
            quantity VARCHAR(50) DEFAULT '30 Tabs',
            frequency VARCHAR(50) DEFAULT 'Once daily',
            instruction VARCHAR(255) DEFAULT '',
            notes TEXT,
            color VARCHAR(10) DEFAULT '#4CAF50',
            icon VARCHAR(20) DEFAULT 'pill',
            pill_count INT DEFAULT 1,
            pills_remaining INT DEFAULT 30,
            refill_date DATE NULL,
            qr_code VARCHAR(255) NULL,
            duration VARCHAR(50) DEFAULT '30 days',
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """,

        # Medicine schedules table
        """
        CREATE TABLE IF NOT EXISTS medicine_schedules (
            id INT AUTO_INCREMENT PRIMARY KEY,
            medicine_id INT NOT NULL,
            time VARCHAR(10) NOT NULL,
            day_of_week VARCHAR(10) DEFAULT 'daily',
            FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
        )
        """,

        # Reminders table
        """
        CREATE TABLE IF NOT EXISTS reminders (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            medicine_id INT NOT NULL,
            scheduled_time DATETIME NOT NULL,
            status ENUM('upcoming', 'snoozed', 'completed', 'missed') DEFAULT 'upcoming',
            snooze_until DATETIME NULL,
            voice_enabled BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
        )
        """,

        # Dose logs table
        """
        CREATE TABLE IF NOT EXISTS dose_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            medicine_id INT NOT NULL,
            scheduled_time VARCHAR(10) NOT NULL,
            taken_at TIMESTAMP NULL,
            status ENUM('taken', 'missed', 'snoozed', 'pending') DEFAULT 'pending',
            dose_date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
        )
        """,

        # Caretaker-patient relationships
        """
        CREATE TABLE IF NOT EXISTS caretaker_patients (
            id INT AUTO_INCREMENT PRIMARY KEY,
            caretaker_id INT NOT NULL,
            patient_id INT NOT NULL,
            relationship VARCHAR(50) DEFAULT 'family',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (caretaker_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_pair (caretaker_id, patient_id)
        )
        """,

        # Caretaker contacts (manually entered name + phone)
        """
        CREATE TABLE IF NOT EXISTS caretaker_contacts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            name VARCHAR(100) NOT NULL,
            phone VARCHAR(20) NOT NULL,
            relationship VARCHAR(50) DEFAULT 'family',
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """,

        # Alerts table
        """
        CREATE TABLE IF NOT EXISTS alerts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            caretaker_id INT NULL,
            type ENUM('error', 'info', 'success', 'warning', 'emergency') DEFAULT 'info',
            title VARCHAR(200) NOT NULL,
            description TEXT,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """,

        # Health insights table
        """
        CREATE TABLE IF NOT EXISTS health_insights (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            steps INT DEFAULT 0,
            sleep_hours INT DEFAULT 0,
            sleep_mins INT DEFAULT 0,
            insight_date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_date (user_id, insight_date)
        )
        """,

        # Reminder behavior tracking (for smart scheduling)
        """
        CREATE TABLE IF NOT EXISTS reminder_behavior (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            medicine_id INT NOT NULL,
            miss_count INT DEFAULT 0,
            snooze_count INT DEFAULT 0,
            avg_delay_mins FLOAT DEFAULT 0,
            total_events INT DEFAULT 0,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE,
            UNIQUE KEY unique_user_med (user_id, medicine_id)
        )
        """,

        # Drug interactions reference table
        """
        CREATE TABLE IF NOT EXISTS drug_interactions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            drug_a VARCHAR(100) NOT NULL,
            drug_b VARCHAR(100) NOT NULL,
            severity ENUM('mild', 'moderate', 'severe') DEFAULT 'mild',
            description TEXT
        )
        """,
    ]

    for table_sql in tables:
        cursor.execute(table_sql)

    # Add new columns to existing tables (safe ALTERs — ignore if exist)
    alter_statements = [
        "ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL",
        "ALTER TABLE medicines ADD COLUMN pills_remaining INT DEFAULT 30",
        "ALTER TABLE medicines ADD COLUMN refill_date DATE NULL",
        "ALTER TABLE medicines ADD COLUMN qr_code VARCHAR(255) NULL",
        "ALTER TABLE medicines ADD COLUMN duration VARCHAR(50) DEFAULT '30 days'",
        "ALTER TABLE users MODIFY COLUMN role ENUM('patient', 'caretaker', 'admin') DEFAULT 'patient'",
        "ALTER TABLE alerts MODIFY COLUMN type ENUM('error', 'info', 'success', 'warning', 'emergency') DEFAULT 'info'",
    ]
    for stmt in alter_statements:
        try:
            cursor.execute(stmt)
        except mysql.connector.errors.ProgrammingError:
            pass  # Column already exists

    conn.commit()

    # Add performance indexes for production queries
    perf_indexes = [
        ('dose_logs', 'idx_dose_date', '(dose_date)'),
        ('dose_logs', 'idx_dose_user_date', '(user_id, dose_date)'),
        ('dose_logs', 'idx_dose_status', '(status)'),
        ('reminders', 'idx_reminder_status', '(status)'),
        ('reminders', 'idx_reminder_user_status', '(user_id, status)'),
        ('alerts', 'idx_alerts_user_read', '(user_id, is_read)'),
        ('alerts', 'idx_alerts_caretaker', '(caretaker_id)'),
        ('medicines', 'idx_medicines_active', '(user_id, is_active)'),
        ('medicines', 'idx_medicines_qr', '(qr_code)'),
    ]
    for table, name, cols in perf_indexes:
        try:
            cursor.execute(f'CREATE INDEX {name} ON {table} {cols}')
        except Exception:
            pass  # Index already exists

    conn.commit()
    cursor.close()
    conn.close()
    print("✅ All database tables and indexes created successfully!")

