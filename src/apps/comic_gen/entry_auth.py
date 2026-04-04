import hashlib
import hmac
import os
import time
from typing import Optional

from fastapi import Request
from fastapi.responses import Response


ENTRY_PASSWORD_ENV_KEYS = ("LUMENX_ENTRY_PASSWORD", "ENTRY_PASSWORD")
ENTRY_AUTH_SECRET_ENV_KEY = "LUMENX_ENTRY_AUTH_SECRET"
ENTRY_AUTH_COOKIE_NAME = "lumenx_entry_session"
ENTRY_AUTH_TTL_ENV_KEY = "LUMENX_ENTRY_SESSION_TTL_SECONDS"
DEFAULT_ENTRY_AUTH_TTL_SECONDS = 60 * 60 * 12

AUTH_EXEMPT_PATHS = {
    "/auth/status",
    "/auth/login",
    "/auth/logout",
    "/config/env",
    "/config/auth/status",
    "/config/auth/login",
    "/config/auth/logout",
}


def get_entry_password() -> str:
    for key in ENTRY_PASSWORD_ENV_KEYS:
        value = (os.getenv(key) or "").strip()
        if value:
            return value
    return ""


def get_entry_auth_ttl_seconds() -> int:
    raw = (os.getenv(ENTRY_AUTH_TTL_ENV_KEY) or "").strip()
    try:
        ttl = int(raw)
    except (TypeError, ValueError):
        ttl = DEFAULT_ENTRY_AUTH_TTL_SECONDS
    return max(ttl, 300)


def is_entry_auth_enabled() -> bool:
    return bool(get_entry_password())


def verify_entry_password(candidate: str) -> bool:
    expected = get_entry_password()
    if not expected:
        return True
    return hmac.compare_digest(candidate or "", expected)


def _signing_secret() -> bytes:
    configured_secret = (os.getenv(ENTRY_AUTH_SECRET_ENV_KEY) or "").strip()
    if configured_secret:
        return configured_secret.encode("utf-8")
    password = get_entry_password()
    return hashlib.sha256(f"lumenx-entry-auth::{password}".encode("utf-8")).digest()


def create_entry_session_token(now: Optional[int] = None) -> str:
    issued_at = int(now or time.time())
    expires_at = issued_at + get_entry_auth_ttl_seconds()
    payload = str(expires_at)
    signature = hmac.new(_signing_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{payload}.{signature}"


def verify_entry_session_token(token: Optional[str], now: Optional[int] = None) -> bool:
    if not is_entry_auth_enabled():
        return True
    if not token or "." not in token:
        return False

    expires_at_raw, provided_signature = token.split(".", 1)
    try:
        expires_at = int(expires_at_raw)
    except ValueError:
        return False

    if expires_at < int(now or time.time()):
        return False

    expected_signature = hmac.new(
        _signing_secret(),
        expires_at_raw.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(provided_signature, expected_signature)


def is_request_authenticated(request: Request) -> bool:
    if not is_entry_auth_enabled():
        return True
    return verify_entry_session_token(request.cookies.get(ENTRY_AUTH_COOKIE_NAME))


def should_skip_entry_auth(request: Request) -> bool:
    if request.method == "OPTIONS":
        return True
    path = request.url.path.rstrip("/") or "/"
    if path in AUTH_EXEMPT_PATHS:
        return True
    if path in {"/openapi.json", "/docs", "/redoc"}:
        return True
    return False


def set_entry_auth_cookie(response: Response, request: Request) -> None:
    response.set_cookie(
        key=ENTRY_AUTH_COOKIE_NAME,
        value=create_entry_session_token(),
        max_age=get_entry_auth_ttl_seconds(),
        httponly=True,
        secure=request.url.scheme == "https",
        samesite="lax",
        path="/",
    )


def clear_entry_auth_cookie(response: Response, request: Request) -> None:
    response.delete_cookie(
        key=ENTRY_AUTH_COOKIE_NAME,
        httponly=True,
        secure=request.url.scheme == "https",
        samesite="lax",
        path="/",
    )
