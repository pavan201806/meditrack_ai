from database.schema import get_connection
from utils.helpers import format_time_ago


def link_caretaker_patient(caretaker_id, patient_id, relationship='family'):
    """Link a caretaker to a patient."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """INSERT INTO caretaker_patients (caretaker_id, patient_id, relationship)
               VALUES (%s, %s, %s)""",
            (caretaker_id, patient_id, relationship)
        )
        conn.commit()
        link_id = cursor.lastrowid
    except Exception:
        conn.rollback()
        link_id = None
    finally:
        cursor.close()
        conn.close()
    return link_id


def get_patients_for_caretaker(caretaker_id):
    """Get all patients linked to a caretaker."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """SELECT u.id, u.name, u.email, u.avatar_url, cp.relationship, cp.created_at
           FROM caretaker_patients cp
           JOIN users u ON cp.patient_id = u.id
           WHERE cp.caretaker_id = %s""",
        (caretaker_id,)
    )
    patients = cursor.fetchall()
    for p in patients:
        if p.get('created_at'):
            p['created_at'] = str(p['created_at'])
    cursor.close()
    conn.close()
    return patients


def get_patient_detail(caretaker_id, patient_id):
    """Get detailed patient info for a caretaker."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    # Verify relationship
    cursor.execute(
        "SELECT * FROM caretaker_patients WHERE caretaker_id = %s AND patient_id = %s",
        (caretaker_id, patient_id)
    )
    if not cursor.fetchone():
        cursor.close()
        conn.close()
        return None

    # Get patient info
    cursor.execute(
        "SELECT id, name, email, avatar_url FROM users WHERE id = %s",
        (patient_id,)
    )
    patient = cursor.fetchone()

    cursor.close()
    conn.close()
    return patient
