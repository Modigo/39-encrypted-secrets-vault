from contextlib import contextmanager

import pytest
from cryptography.exceptions import InvalidTag
from fastapi import HTTPException
from pydantic import ValidationError

from backend import main


def test_encrypt_decrypt_round_trip_uses_configured_key(monkeypatch):
    monkeypatch.setattr(main, "KEY", b"t" * 32)

    nonce, ciphertext = main.encrypt("test-only value", 17, 3)

    assert main.decrypt(
        {"id": 17, "nonce": nonce, "ciphertext": ciphertext, "version": 3}
    ) == "test-only value"


def test_decrypt_rejects_modified_ciphertext(monkeypatch):
    monkeypatch.setattr(main, "KEY", b"t" * 32)
    nonce, ciphertext = main.encrypt("test-only value", 17, 3)
    altered = ciphertext[:-1] + bytes([ciphertext[-1] ^ 1])

    with pytest.raises(InvalidTag):
        main.decrypt(
            {"id": 17, "nonce": nonce, "ciphertext": altered, "version": 3}
        )


@pytest.mark.parametrize("username", ["ab", "contains spaces", "bad/name"])
def test_register_rejects_invalid_usernames(username):
    with pytest.raises(ValidationError):
        main.Register(username=username)


def test_register_token_can_sign_in_and_unissued_token_is_rejected(monkeypatch):
    users = {}

    class Result:
        def __init__(self, row=None):
            self.row = row

        def fetchone(self):
            return self.row

    class Connection:
        def execute(self, query, params):
            if query.startswith("INSERT INTO users"):
                username, token_hash = params
                users[username] = {"id": 1, "username": username, "token_hash": token_hash}
                return Result()
            token_hash = params[0]
            row = next(
                (user for user in users.values() if user["token_hash"] == token_hash),
                None,
            )
            return Result(row)

    @contextmanager
    def fake_db():
        yield Connection()

    monkeypatch.setattr(main, "db", fake_db)

    registered = main.register(main.Register(username="alice"))
    signed_in = main.me(f"Bearer {registered['token']}")

    assert signed_in == {"id": 1, "username": "alice"}
    assert users["alice"]["token_hash"] == main.digest(registered["token"])
    assert users["alice"]["token_hash"] != registered["token"]

    with pytest.raises(HTTPException) as error:
        main.me("Bearer user-created-token")

    assert error.value.status_code == 401
    assert error.value.detail == "Invalid token"


@pytest.mark.parametrize("level", ["read", "write"])
def test_secret_access_denies_other_user_without_grant(level):
    class Connection:
        def execute(self, query, _params):
            if query.startswith("SELECT * FROM secrets"):
                return type("Result", (), {"fetchone": lambda _self: {"id": 17, "owner_id": 1}})()
            return type("Result", (), {"fetchone": lambda _self: None})()

        def commit(self):
            pass

        def execute_log(self, *_args):
            pass

    with pytest.raises(HTTPException) as error:
        main.access(Connection(), 17, 2, level)

    assert error.value.status_code == 403
    assert error.value.detail == "Permission denied"


def test_read_grant_does_not_allow_secret_update():
    class Result:
        def __init__(self, row):
            self.row = row

        def fetchone(self):
            return self.row

    class Connection:
        def execute(self, query, _params):
            if query.startswith("SELECT * FROM secrets"):
                return Result({"id": 17, "owner_id": 1})
            if query.startswith("SELECT permission"):
                return Result({"permission": "read"})
            return Result(None)

        def commit(self):
            pass

    with pytest.raises(HTTPException) as error:
        main.access(Connection(), 17, 2, "write")

    assert error.value.status_code == 403


def test_write_grant_allows_secret_update():
    class Result:
        def __init__(self, row):
            self.row = row

        def fetchone(self):
            return self.row

    class Connection:
        def execute(self, query, _params):
            if query.startswith("SELECT * FROM secrets"):
                return Result({"id": 17, "owner_id": 1})
            return Result({"permission": "write"})

    secret = main.access(Connection(), 17, 2, "write")

    assert secret == {"id": 17, "owner_id": 1}


def test_read_grant_cannot_delete_another_users_secret(monkeypatch):
    @contextmanager
    def fake_db():
        yield object()

    monkeypatch.setattr(main, "actor", lambda _authorization: {"id": 2})
    monkeypatch.setattr(main, "access", lambda *_args: {"owner_id": 1})
    monkeypatch.setattr(main, "db", fake_db)

    with pytest.raises(HTTPException) as error:
        main.delete(17, "Bearer test")

    assert error.value.status_code == 403
    assert error.value.detail == "Only owner can delete"


def test_rotate_reports_concurrent_update(monkeypatch):
    class Cursor:
        rowcount = 0

    class Connection:
        def execute(self, *_args):
            return Cursor()

    @contextmanager
    def fake_db():
        yield Connection()

    monkeypatch.setattr(main, "actor", lambda _authorization: {"id": 1})
    monkeypatch.setattr(main, "access", lambda *_args: {"version": 1})
    monkeypatch.setattr(main, "db", fake_db)

    with pytest.raises(HTTPException) as error:
        main.rotate(17, main.ValueInput(value="test-only value"), "Bearer test")

    assert error.value.status_code == 409