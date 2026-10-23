import base64
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from dotenv import load_dotenv


load_dotenv()


def get_encryption_key() -> bytes:
    """Load and validate the AES-256 encryption key."""

    encoded_key = os.getenv("VAULT_MASTER_KEY")

    if not encoded_key:
        raise RuntimeError("Encryption key is not configured.")

    try:
        key = base64.b64decode(
            encoded_key.encode("ascii"),
            altchars=b"-_",
            validate=True,
        )
    except (ValueError, UnicodeEncodeError):
        raise RuntimeError(
            "Encryption key configuration is invalid."
        ) from None

    if len(key) != 32:
        raise RuntimeError(
            "Encryption key must decode to exactly 32 bytes."
        )

    return key


def encrypt_secret(plaintext: str) -> tuple[bytes, bytes]:
    """Encrypt a secret and return its ciphertext and nonce."""

    if not isinstance(plaintext, str):
        raise TypeError("Secret value must be a string.")

    key = get_encryption_key()

    # AES-GCM uses a 12-byte nonce.
    nonce = os.urandom(12)

    aesgcm = AESGCM(key)

    ciphertext = aesgcm.encrypt(
        nonce,
        plaintext.encode("utf-8"),
        None,
    )

    return ciphertext, nonce


def decrypt_secret(ciphertext: bytes, nonce: bytes) -> str:
    """Decrypt a secret and verify its authentication tag."""

    if not isinstance(ciphertext, bytes):
        raise TypeError("Ciphertext must be bytes.")

    if not isinstance(nonce, bytes) or len(nonce) != 12:
        raise ValueError("Nonce must be exactly 12 bytes.")

    key = get_encryption_key()

    aesgcm = AESGCM(key)

    try:
        plaintext = aesgcm.decrypt(
            nonce,
            ciphertext,
            None,
        )
    except InvalidTag:
        raise ValueError(
            "Secret decryption failed."
        ) from None

    return plaintext.decode("utf-8")