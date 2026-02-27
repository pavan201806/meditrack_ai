from database.schema import get_connection


def generate_default_schedules(frequency, instruction=''):
    """Generate default schedule times based on frequency and timing."""
    freq_lower = (frequency or '').lower()
    timing_lower = (instruction or '').lower()

    # Default time sets
    SCHEDULES = {
        'once daily': ['08:00'],
        'twice daily': ['08:00', '20:00'],
        'three times daily': ['08:00', '14:00', '20:00'],
        'four times daily': ['08:00', '12:00', '16:00', '20:00'],
    }

    times = SCHEDULES.get(freq_lower, ['08:00'])

    # Adjust for timing instructions
    if 'before food' in timing_lower or 'before meal' in timing_lower:
        adjusted = []
        for t in times:
            h, m = map(int, t.split(':'))
            # Shift 30 min earlier for "before food"
            if h == 8:
                adjusted.append('07:30')
            elif h == 14:
                adjusted.append('13:30')
            elif h == 20:
                adjusted.append('19:30')
            else:
                adjusted.append(t)
        times = adjusted
    elif 'after food' in timing_lower or 'after meal' in timing_lower:
        adjusted = []
        for t in times:
            h, m = map(int, t.split(':'))
            if h == 8:
                adjusted.append('08:30')
            elif h == 14:
                adjusted.append('14:30')
            elif h == 20:
                adjusted.append('20:30')
            else:
                adjusted.append(t)
        times = adjusted

    return times


def create_medicine(user_id, name, dosage, med_type='Oral Tablet', quantity='30 Tabs',
                    frequency='Once daily', instruction='', notes='', color='#4CAF50',
                    icon='pill', pill_count=1, schedules=None):
    """Create a new medicine with its schedules and auto-create reminders."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """INSERT INTO medicines
           (user_id, name, dosage, type, quantity, frequency, instruction, notes, color, icon, pill_count)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (user_id, name, dosage, med_type, quantity, frequency, instruction, notes, color, icon, pill_count)
    )
    medicine_id = cursor.lastrowid

    # Auto-generate schedules from frequency if none provided
    if not schedules:
        schedules = generate_default_schedules(frequency, instruction)

    # Add schedules and auto-create reminders
    if schedules:
        from datetime import datetime, date
        today = date.today()
        for time_str in schedules:
            cursor.execute(
                "INSERT INTO medicine_schedules (medicine_id, time) VALUES (%s, %s)",
                (medicine_id, time_str)
            )
            # Auto-create a reminder for today
            try:
                t = datetime.strptime(time_str, '%H:%M')
                reminder_dt = datetime.combine(today, t.time())
                cursor.execute(
                    """INSERT INTO reminders (user_id, medicine_id, scheduled_time, status)
                       VALUES (%s, %s, %s, 'upcoming')""",
                    (user_id, medicine_id, reminder_dt)
                )
            except ValueError:
                pass

    conn.commit()
    cursor.close()
    conn.close()
    return medicine_id


def get_medicines_by_user(user_id):
    """Get all active medicines for a user with their schedules."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute(
        """SELECT m.*, GROUP_CONCAT(ms.time ORDER BY ms.time) as schedule_times
           FROM medicines m
           LEFT JOIN medicine_schedules ms ON m.id = ms.medicine_id
           WHERE m.user_id = %s AND m.is_active = TRUE
           GROUP BY m.id
           ORDER BY m.created_at DESC""",
        (user_id,)
    )
    medicines = cursor.fetchall()

    # Parse schedule_times into list
    for med in medicines:
        if med['schedule_times']:
            med['schedule'] = med['schedule_times'].split(',')
        else:
            med['schedule'] = []
        del med['schedule_times']
        # Convert datetime objects to strings
        if med.get('created_at'):
            med['created_at'] = str(med['created_at'])
        if med.get('updated_at'):
            med['updated_at'] = str(med['updated_at'])

    cursor.close()
    conn.close()
    return medicines


def get_medicine_by_id(medicine_id, user_id):
    """Get a specific medicine by ID."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute(
        """SELECT m.*, GROUP_CONCAT(ms.time ORDER BY ms.time) as schedule_times
           FROM medicines m
           LEFT JOIN medicine_schedules ms ON m.id = ms.medicine_id
           WHERE m.id = %s AND m.user_id = %s
           GROUP BY m.id""",
        (medicine_id, user_id)
    )
    med = cursor.fetchone()

    if med:
        med['schedule'] = med['schedule_times'].split(',') if med['schedule_times'] else []
        del med['schedule_times']
        if med.get('created_at'):
            med['created_at'] = str(med['created_at'])
        if med.get('updated_at'):
            med['updated_at'] = str(med['updated_at'])

    cursor.close()
    conn.close()
    return med


def update_medicine(medicine_id, user_id, **kwargs):
    """Update medicine fields."""
    conn = get_connection()
    cursor = conn.cursor()

    allowed_fields = ['name', 'dosage', 'type', 'quantity', 'frequency',
                      'instruction', 'notes', 'color', 'icon', 'pill_count', 'is_active']

    updates = []
    values = []
    for field, value in kwargs.items():
        if field in allowed_fields:
            updates.append(f"{field} = %s")
            values.append(value)

    if updates:
        values.extend([medicine_id, user_id])
        cursor.execute(
            f"UPDATE medicines SET {', '.join(updates)} WHERE id = %s AND user_id = %s",
            values
        )

    # Update schedules if provided
    if 'schedules' in kwargs and kwargs['schedules'] is not None:
        cursor.execute("DELETE FROM medicine_schedules WHERE medicine_id = %s", (medicine_id,))
        for time_str in kwargs['schedules']:
            cursor.execute(
                "INSERT INTO medicine_schedules (medicine_id, time) VALUES (%s, %s)",
                (medicine_id, time_str)
            )

    conn.commit()
    cursor.close()
    conn.close()


def delete_medicine(medicine_id, user_id):
    """Hard delete a medicine and all related data (schedules, reminders, dose logs)."""
    conn = get_connection()
    cursor = conn.cursor()

    # Verify ownership first
    cursor.execute("SELECT id FROM medicines WHERE id = %s AND user_id = %s", (medicine_id, user_id))
    if not cursor.fetchone():
        cursor.close()
        conn.close()
        return False

    # Cascade delete related data
    cursor.execute("DELETE FROM dose_logs WHERE medicine_id = %s", (medicine_id,))
    cursor.execute("DELETE FROM reminders WHERE medicine_id = %s", (medicine_id,))
    cursor.execute("DELETE FROM medicine_schedules WHERE medicine_id = %s", (medicine_id,))
    cursor.execute("DELETE FROM medicines WHERE id = %s AND user_id = %s", (medicine_id, user_id))

    conn.commit()
    affected = cursor.rowcount
    cursor.close()
    conn.close()
    return affected > 0
