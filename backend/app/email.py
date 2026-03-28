import os
import resend

resend.api_key = os.getenv("RESEND_API_KEY", "")

FROM_EMAIL = os.getenv("FROM_EMAIL", "Seasoning <onboarding@resend.dev>")


def _send(to_email: str, subject: str, html: str):
    if not resend.api_key:
        print(f"[EMAIL] To: {to_email} | Subject: {subject}")
        return
    resend.Emails.send({
        "from": FROM_EMAIL,
        "to": [to_email],
        "subject": subject,
        "html": html,
    })


def send_password_reset(to_email: str, reset_link: str):
    _send(to_email, "Reset your Seasoning password", (
        f"<p>Hi,</p>"
        f"<p>We received a request to reset your password. "
        f"Click the link below to set a new one:</p>"
        f'<p><a href="{reset_link}">Reset my password</a></p>'
        f"<p>This link expires in 30 minutes. "
        f"If you didn't request this, you can safely ignore this email.</p>"
        f"<p>— Seasoning</p>"
    ))


def send_welcome_email(to_email: str, name: str):
    _send(to_email, f"Welcome to Seasoning, {name}!", (
        f"<p>Hi {name},</p>"
        f"<p>Welcome to <strong>Seasoning</strong> — your personal recipe book.</p>"
        f"<p>Whether it's a recipe from your favourite website, a dish from a cookbook, "
        f"or your grandma's handwritten notes scribbled on the back of an envelope — "
        f"Seasoning keeps them all in one place.</p>"
        f"<p>From here you can:</p>"
        f"<ul>"
        f"<li>Save recipes from anywhere — paste text, snap a photo, or grab one from a website</li>"
        f"<li>Adjust to your tastes — make it veggie, scale the servings, swap out ingredients</li>"
        f"<li>Stock your larder and let us suggest what to cook tonight</li>"
        f"<li>Share your favourites with friends</li>"
        f"</ul>"
        f"<p>Happy cooking!</p>"
        f"<p>— The Seasoning team</p>"
    ))


def send_friend_invite_email(to_email: str, from_name: str):
    _send(to_email, f"{from_name} wants to share recipes with you!", (
        f"<p>Hi there,</p>"
        f"<p><strong>{from_name}</strong> has sent you a friend request on Seasoning.</p>"
        f"<p>Accept their invite and you'll be able to browse each other's recipe books, "
        f"save each other's favourites, and get cooking together.</p>"
        f"<p>Log in to Seasoning to accept.</p>"
        f"<p>— Seasoning</p>"
    ))


def send_friend_accepted_email(to_email: str, friend_name: str):
    _send(to_email, f"{friend_name} accepted your friend request!", (
        f"<p>Great news!</p>"
        f"<p><strong>{friend_name}</strong> has accepted your friend request on Seasoning. "
        f"You can now browse their recipe book and save any of their recipes to yours.</p>"
        f"<p>Happy cooking together!</p>"
        f"<p>— Seasoning</p>"
    ))
