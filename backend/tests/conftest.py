"""Run the same API suite against SQLite and an isolated PostgreSQL schema.

Set TEST_POSTGRES_URL to a disposable local test database to enable PostgreSQL.
Each test creates and removes its own uniquely named schema.
"""
import os
import uuid
import pytest
import psycopg
from psycopg import sql
import app as module


@pytest.fixture(autouse=True, params=['sqlite'] + (['postgresql'] if os.getenv('TEST_POSTGRES_URL') else []))
def database_backend(request, tmp_path, monkeypatch):
    monkeypatch.setattr(module, 'DATABASE_URL', '')
    monkeypatch.setattr(module, 'DB_PATH', str(tmp_path / 'isolated.db'))
    if request.param == 'sqlite':
        yield request.param
        return
    url = os.environ['TEST_POSTGRES_URL']
    schema = 'cantea_test_' + uuid.uuid4().hex
    with psycopg.connect(url, autocommit=True) as conn:
        conn.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(schema)))
    # The application accepts a URL; append encoded connection options for isolation.
    from urllib.parse import quote
    scoped = url + ('&' if '?' in url else '?') + 'options=' + quote('-c search_path=' + schema)
    monkeypatch.setattr(module, 'DATABASE_URL', scoped)
    try:
        yield request.param
    finally:
        with psycopg.connect(url, autocommit=True) as conn:
            conn.execute(sql.SQL('DROP SCHEMA {} CASCADE').format(sql.Identifier(schema)))
