from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


def _smtp_configured() -> bool:
    return bool(settings.smtp_host and settings.smtp_from)


def send_email(to: str, subject: str, text: str, html: str | None = None) -> bool:
    if not _smtp_configured():
        logger.warning(
            "SMTP not configured; email to %s skipped. Subject: %s\n%s",
            to,
            subject,
            text,
        )
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")

    try:
        if settings.smtp_use_ssl:
            smtp_cls = smtplib.SMTP_SSL
        else:
            smtp_cls = smtplib.SMTP
        with smtp_cls(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            if not settings.smtp_use_ssl and settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_user and settings.smtp_password:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
        return True
    except Exception as exc:
        logger.exception("failed to send email to %s: %s", to, exc)
        return False


def send_password_reset_email(to: str, reset_url: str) -> bool:
    subject = "Восстановление пароля — SmartAnalyzer"
    text = (
        "Здравствуйте!\n\n"
        "Мы получили запрос на восстановление пароля для вашего аккаунта.\n"
        f"Перейдите по ссылке, чтобы задать новый пароль (действует 1 час):\n{reset_url}\n\n"
        "Если вы не запрашивали восстановление, просто проигнорируйте это письмо.\n\n"
        "— SmartAnalyzer"
    )
    html = f"""<!doctype html>
<html><body style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; background:#f5f5f4; padding:32px;">
  <div style="max-width:520px; margin:0 auto; background:#ffffff; border:1px solid #e4e4e7; border-radius:18px; padding:32px;">
    <h2 style="margin:0 0 12px; color:#18181b;">Восстановление пароля</h2>
    <p style="color:#52525b; line-height:1.6;">Мы получили запрос на сброс пароля для вашего аккаунта SmartAnalyzer.</p>
    <p style="margin:24px 0;">
      <a href="{reset_url}" style="display:inline-block; padding:12px 22px; background:#18181b; color:#fff; text-decoration:none; border-radius:12px; font-weight:600;">Задать новый пароль</a>
    </p>
    <p style="color:#71717a; font-size:13px;">Ссылка действительна 1 час. Если кнопка не работает, скопируйте адрес:<br/>
      <a href="{reset_url}" style="color:#0369a1; word-break:break-all;">{reset_url}</a></p>
    <p style="color:#a1a1aa; font-size:12px; margin-top:24px;">Если вы не запрашивали восстановление, просто проигнорируйте письмо.</p>
  </div>
</body></html>"""
    return send_email(to, subject, text, html)
