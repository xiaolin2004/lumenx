import asyncio

from starlette.requests import Request

from src.apps.comic_gen import api as api_module
from src.apps.comic_gen.entry_auth import (
    create_entry_session_token,
    verify_entry_session_token,
)


def test_entry_auth_session_token_roundtrip(monkeypatch):
    monkeypatch.setenv("LUMENX_ENTRY_PASSWORD", "test-secret")
    token = create_entry_session_token(now=1_000)

    assert verify_entry_session_token(token, now=1_100) is True
    assert verify_entry_session_token(token, now=1_000 + 60 * 60 * 12 + 1) is False
    assert verify_entry_session_token("bad.token", now=1_100) is False


def test_get_env_config_redacts_entry_password(monkeypatch):
    monkeypatch.setenv("LUMENX_ENTRY_PASSWORD", "top-secret")
    request = Request({"type": "http", "method": "GET", "path": "/config/env", "headers": []})

    payload = asyncio.run(api_module.get_env_config(request))

    assert payload["LUMENX_ENTRY_PASSWORD"] == ""
    assert payload["LUMENX_ENTRY_PASSWORD_CONFIGURED"] is True
