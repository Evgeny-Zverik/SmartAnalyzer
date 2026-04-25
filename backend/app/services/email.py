from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def _resend_configured() -> bool:
    return bool(settings.resend_api_key and settings.smtp_from)


def _smtp_configured() -> bool:
    return bool(settings.smtp_host and settings.smtp_from)


def _send_via_resend_api(to: str, subject: str, text: str, html: str | None) -> bool:
    payload: dict = {
        "from": settings.smtp_from,
        "to": [to],
        "subject": subject,
        "text": text,
    }
    if html:
        payload["html"] = html
    try:
        resp = httpx.post(
            settings.resend_api_url,
            headers={
                "Authorization": f"Bearer {settings.resend_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=15.0,
        )
        if resp.status_code >= 400:
            logger.error(
                "Resend API error %s for %s: %s", resp.status_code, to, resp.text
            )
            return False
        return True
    except Exception as exc:
        logger.exception("failed to send via Resend API to %s: %s", to, exc)
        return False


def _send_via_smtp(to: str, subject: str, text: str, html: str | None) -> bool:
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
        logger.exception("failed to send email via SMTP to %s: %s", to, exc)
        return False


def send_email(to: str, subject: str, text: str, html: str | None = None) -> bool:
    if _resend_configured():
        return _send_via_resend_api(to, subject, text, html)
    if _smtp_configured():
        return _send_via_smtp(to, subject, text, html)
    logger.warning(
        "Email not configured; message to %s skipped. Subject: %s\n%s",
        to,
        subject,
        text,
    )
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
