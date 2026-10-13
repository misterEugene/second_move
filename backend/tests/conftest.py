import os
import subprocess
import sys
from pathlib import Path

import pytest

TEST_DB = os.environ.get("TEST_DATABASE_URL")
if not TEST_DB:
    raise RuntimeError("Задайте TEST_DATABASE_URL для тестов")
os.environ["DATABASE_URL"] = TEST_DB
os.environ.setdefault("JWT_SECRET", "test-secret-0123456789abcdef")

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="session")
def client():
    engine = create_engine(TEST_DB)
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"))
    engine.dispose()
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=ROOT, check=True, capture_output=True)

    from app.main import app

    with TestClient(app) as c:
        yield c
