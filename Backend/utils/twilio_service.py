"""
Twilio Service — SMS + Voice Call for Caretaker Alerts
======================================================
Uses Twilio REST API to send SMS messages and make voice calls
when a patient misses consecutive medicine doses.

Note: Trial accounts can only send to verified numbers.
"""
import os
from config import Config

# Lazy-load the Twilio client (only created once)
_client = None


def _get_client():
    """Get or create the Twilio client (singleton)."""
    global _client
    if _client is None:
        from twilio.rest import Client
        sid = Config.TWILIO_ACCOUNT_SID
        token = Config.TWILIO_AUTH_TOKEN
        if not sid or not token:
            print("⚠️  Twilio credentials not set in .env — SMS/calls disabled.")
            return None
        _client = Client(sid, token)
        print("✅ Twilio client initialized.")
    return _client


def _format_phone(number):
    """
    Ensure phone number is in E.164 format.
    - 10 digits (Indian mobile) → prepend +91
    - Already starts with + → leave as-is
    - Otherwise → prepend +91 as default
    """
    num = str(number).strip().replace(' ', '').replace('-', '')
    if num.startswith('+'):
        return num
    # Remove leading 0 if present (e.g. 07013367472 → 7013367472)
    if num.startswith('0'):
        num = num[1:]
    # 10-digit Indian mobile number
    if len(num) == 10:
        return f'+91{num}'
    # Already has country code without + (e.g. 917013367472)
    if len(num) == 12 and num.startswith('91'):
        return f'+{num}'
    return f'+91{num}'


def send_sms(to_number, message):
    """
    Send an SMS message via Twilio.

    Args:
        to_number: Recipient phone number (E.164 format, e.g. +919876543210)
        message: SMS body text (max ~1600 chars, auto-split by Twilio)

    Returns:
        dict with 'success', 'sid', and 'error' keys
    """
    to_number = _format_phone(to_number)
    client = _get_client()
    if client is None:
        return {'success': False, 'sid': None, 'error': 'Twilio not configured'}

    try:
        msg = client.messages.create(
            body=message,
            from_=Config.TWILIO_NUMBER,
            to=to_number,
        )
        print(f"📱 SMS sent to {to_number} | SID: {msg.sid}")
        return {'success': True, 'sid': msg.sid, 'error': None}
    except Exception as e:
        print(f"❌ SMS to {to_number} failed: {e}")
        return {'success': False, 'sid': None, 'error': str(e)}


def make_call(to_number, alert_message):
    """
    Make a voice call via Twilio that reads out the alert message.

    Uses TwiML <Say> verb so the caretaker hears the alert when they pick up.
    The message is repeated twice for clarity.

    Args:
        to_number: Recipient phone number (E.164 format)
        alert_message: Text to be spoken aloud on the call

    Returns:
        dict with 'success', 'sid', and 'error' keys
    """
    to_number = _format_phone(to_number)
    client = _get_client()
    if client is None:
        return {'success': False, 'sid': None, 'error': 'Twilio not configured'}

    # Build inline TwiML — message spoken twice with a pause
    twiml = (
        f'<Response>'
        f'<Say voice="alice" language="en-US">{alert_message}</Say>'
        f'<Pause length="2"/>'
        f'<Say voice="alice" language="en-US">I repeat: {alert_message}</Say>'
        f'</Response>'
    )

    try:
        call = client.calls.create(
            twiml=twiml,
            from_=Config.TWILIO_NUMBER,
            to=to_number,
        )
        print(f"📞 Call placed to {to_number} | SID: {call.sid}")
        return {'success': True, 'sid': call.sid, 'error': None}
    except Exception as e:
        print(f"❌ Call to {to_number} failed: {e}")
        return {'success': False, 'sid': None, 'error': str(e)}
