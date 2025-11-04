import os

import pytest


@pytest.fixture(scope="session", autouse=True)
def _override_database_uri():
    """
    Ensure tests use an isolated in-memory database instead of production defaults.
    """
    original_uri = os.environ.get("DATABASE_URI")
    os.environ["DATABASE_URI"] = "sqlite+pysqlite:///:memory:"
    try:
        yield
    finally:
        if original_uri is None:
            os.environ.pop("DATABASE_URI", None)
        else:
            os.environ["DATABASE_URI"] = original_uri
