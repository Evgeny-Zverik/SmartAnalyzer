"""AES-256-GCM encryption at rest.

Format: nonce (12 bytes) || ciphertext || tag (16 bytes)

The encryption key is read from the ENCRYPTION_KEY env var (base64-encoded 32 bytes).
If the key is not set, encryption/decryption are no-ops (passthrough) so that
development environments work without extra configuration.
"""

from __future__ import annotations

import base64
import logging
import os

from app.core.config import settings

logger = logging.getLogger(__name__)

_KEY_BYTES: bytes | None = None


def _get_key() -> bytes | None:
    global _KEY_BYTES
    if _KEY_BYTES is not None:
        return _KEY_BYTES
    raw = settings.encryption_key.strip()
    if not raw:
        return None
    try:
        _KEY_BYTES = base64.b64decode(raw)
        if len(_KEY_BYTES) != 32:
            logger.error("ENCRYPTION_KEY must be 32 bytes (got %d). Encryption disabled.", len(_KEY_BYTES))
            _KEY_BYTES = None
        return _KEY_BYTES
    except Exception:
        logger.error("ENCRYPTION_KEY is not valid base64. Encryption disabled.")
        return None


def encrypt(data: bytes) -> bytes:
    """Encrypt *data* with AES-256-GCM.  Returns raw bytes (nonce+ciphertext+tag)."""
    key = _get_key()
    if key is None:
        return data
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    nonce = os.urandom(12)
    aesgcm = AESGCM(key)
    ct = aesgcm.encrypt(nonce, data, None)  # ct includes the 16-byte tag
    return nonce + ct


def decrypt(data: bytes) -> bytes:
    """Decrypt *data* produced by :func:`encrypt`.

    Falls back to returning *data* unchanged when:
    - encryption key is not configured
    - data is too short to be an AES-GCM payload
    - decryption fails (data was stored before encryption was enabled)
    """
    key = _get_key()
    if key is None:
        return data
    # nonce(12) + tag(16) = 28 minimum overhead
    if len(data) < 28:
        return data
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    nonce = data[:12]
    ct = data[12:]
    aesgcm = AESGCM(key)
    try:
        return aesgcm.decrypt(nonce, ct, None)
    except Exception:
        # Likely plaintext data from before encryption was enabled
        return data


def encrypt_str(value: str) -> str:
    """Encrypt a string and return base64-encoded ciphertext."""
    key = _get_key()
    if key is None:
        return value
    encrypted = encrypt(value.encode("utf-8"))
    return "enc:" + base64.b64encode(encrypted).decode("ascii")


def decrypt_str(value: str) -> str:
    """Decrypt a string produced by :func:`encrypt_str`."""
    if not value.startswith("enc:"):
        return value
    key = _get_key()
    if key is None:
        return value
    try:
        raw = base64.b64decode(value[4:])
        return decrypt(raw).decode("utf-8")
    except Exception:
        return value


def generate_encryption_key() -> str:
    """Generate a random 32-byte key and return it as base64."""
    return base64.b64encode(os.urandom(32)).decode("ascii")


def derive_transport_key(user_id: int) -> str:
    """Derive a per-user transport key from the master encryption key.

    Returns base64-encoded 32-byte key for client-side AES-GCM.
    """
    import hashlib
    import hmac

    master = _get_key()
    if master is None:
        return ""

    derived = hmac.new(
        master,
        f"transport:user:{user_id}".encode(),
        hashlib.sha256,
    ).digest()
    return base64.b64encode(derived).decode("ascii")


def decrypt_transport(value: str, user_id: int) -> str:
    """Decrypt a 'tenc:' prefixed string sent by the browser.

    The browser encrypts with the transport key derived for *user_id*.
    """
    if not value.startswith("tenc:"):
        return value
    import hashlib
    import hmac
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    master = _get_key()
    if master is None:
        return value

    key = hmac.new(master, f"transport:user:{user_id}".encode(), hashlib.sha256).digest()
    try:
        raw = base64.b64decode(value[5:])
        if len(raw) < 28:
            return value
        nonce = raw[:12]
        ct = raw[12:]
        aesgcm = AESGCM(key)
        return aesgcm.decrypt(nonce, ct, None).decode("utf-8")
    except Exception:
        return value


def decrypt_transport_bytes(data: bytes, user_id: int) -> bytes:
    """Decrypt binary data sent by the browser using the transport key."""
    import hashlib
    import hmac
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    master = _get_key()
    if master is None:
        return data
    if len(data) < 28:
        return data

    key = hmac.new(master, f"transport:user:{user_id}".encode(), hashlib.sha256).digest()
    nonce = data[:12]
    ct = data[12:]
    aesgcm = AESGCM(key)
    try:
        return aesgcm.decrypt(nonce, ct, None)
    except Exception:
        return data


def encrypt_transport(value: str, user_id: int) -> str:
    """Encrypt a string for transport to the browser.

    Produces a 'tenc:' prefixed base64 payload the frontend can decrypt.
    """
    import hashlib
    import hmac
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    master = _get_key()
    if master is None:
        return value

    key = hmac.new(master, f"transport:user:{user_id}".encode(), hashlib.sha256).digest()
    nonce = os.urandom(12)
    aesgcm = AESGCM(key)
    ct = aesgcm.encrypt(nonce, value.encode("utf-8"), None)
    return "tenc:" + base64.b64encode(nonce + ct).decode("ascii")
