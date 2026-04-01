import sys

from sqlalchemy.exc import SQLAlchemyError

sys.path.insert(0, "./server")

from app import create_app
from app.config import db
from app.models import AdminAccount


def _build_app(monkeypatch):
    monkeypatch.setenv("DATABASE_URI", "sqlite+pysqlite:///:memory:")
    app = create_app()
    app.config.update(TESTING=True, WTF_CSRF_ENABLED=False)

    with app.app_context():
        db.create_all()
        admin = AdminAccount(name="Admin", email="admin@example.com")
        admin.set_password("password123")
        db.session.add(admin)
        db.session.commit()

    return app


def test_admin_login_survives_audit_log_commit_failure(monkeypatch):
    app = _build_app(monkeypatch)
    client = app.test_client()

    original_commit = db.session.commit
    commit_calls = {"count": 0}

    def flaky_commit(*args, **kwargs):
        commit_calls["count"] += 1
        if commit_calls["count"] == 2:
            raise SQLAlchemyError("audit log table missing")
        return original_commit(*args, **kwargs)

    monkeypatch.setattr(db.session, "commit", flaky_commit)

    response = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "password123"},
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["role"] == "admin"
