import sys

import pytest
from flask import Flask

sys.path.insert(0, "./server")

from app.config import _resolve_database_uri


def test_resolve_database_uri_accepts_tredicy_db(monkeypatch):
    monkeypatch.setenv(
        "DATABASE_URI",
        "postgresql+psycopg2://user:pass@127.0.0.1:5432/tredicy_db",
    )

    assert _resolve_database_uri(Flask(__name__)) == "postgresql+psycopg2://user:pass@127.0.0.1:5432/tredicy_db"


def test_resolve_database_uri_prefers_database_url(monkeypatch):
    monkeypatch.setenv(
        "DATABASE_URI",
        "postgresql+psycopg2://user:pass@127.0.0.1:5432/stale_db",
    )
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+psycopg2://user:pass@127.0.0.1:5432/tredicy_db",
    )

    assert _resolve_database_uri(Flask(__name__)) == "postgresql+psycopg2://user:pass@127.0.0.1:5432/tredicy_db"


def test_resolve_database_uri_rejects_other_database(monkeypatch):
    monkeypatch.setenv(
        "DATABASE_URI",
        "postgresql+psycopg2://user:pass@127.0.0.1:5432/other_db",
    )

    with pytest.raises(RuntimeError, match=r"tredicy_db"):
        _resolve_database_uri(Flask(__name__))


def test_resolve_database_uri_allows_sqlite_for_tests(monkeypatch):
    monkeypatch.setenv("DATABASE_URI", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("PYTEST_CURRENT_TEST", "test_database_uri.py::test_resolve_database_uri_allows_sqlite_for_tests")

    assert _resolve_database_uri(Flask(__name__)) == "sqlite+pysqlite:///:memory:"
