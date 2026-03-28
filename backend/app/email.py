import os
import resend

resend.api_key = os.getenv("RESEND_API_KEY", "")

FROM_EMAIL = os.getenv("FROM_EMAIL", "Seasoning <onboarding@resend.dev>")


def send_password_reset(to_email: str, reset_link: str):
    """Send a password-reset email via Resend.

    Falls back to printing the link if RESEND_API_KEY is not set (local dev).
    """
    if not resend.api_key:
        print(f"[PASSWORD RESET] {to_email} → {reset_link}")
        return

    resend.Emails.send({
        "from": FROM_EMAIL,
        "to": [to_email],
        "subject": "Reset your Seasoning password",
        "html": (
            f"<p>Hi,</p>"
            f"<p>We received a request to reset your password. "
            f"Click the link below to set a new one:</p>"
            f'<p><a href="{reset_link}">Reset my password</a></p>'
            f"<p>This link expires in 30 minutes. "
            f"If you didn't request this, you can safely ignore this email.</p>"
            f"<p>— Seasoning</p>"
        ),
    })
