"""Database adapters. PostgreSQL is selected explicitly with DATABASE_URL."""
from contextlib import contextmanager
from pathlib import Path
import re
import sqlite3
import psycopg

# Keep read-check-write operations serialized, as SQLite BEGIN IMMEDIATE did.
# Transaction-scoped locks also work through transaction-mode connection poolers.
# This deliberately prioritizes correctness over high throughput for the pilot.
TRANSACTION_LOCK = 1128353364
INTEGRITY_ERRORS = (sqlite3.IntegrityError, psycopg.IntegrityError)


class Record(dict):
    def __getitem__(self, key):
        if isinstance(key, int):
            return tuple(self.values())[key]
        return super().__getitem__(key)


def record_factory(cursor):
    names = [column.name for column in cursor.description] if cursor.description else []
    return lambda values: Record(zip(names, values))


def postgres_sql(sql):
    # Replace placeholders outside SQL string literals only. Data always stays bound.
    parts = re.split(r"('(?:''|[^'])*')", sql)
    return ''.join(part if i % 2 else part.replace('?', '%s') for i, part in enumerate(parts))


class PostgresConnection:
    def __init__(self, connection):
        self.connection = connection

    def execute(self, sql, params=()):
        if params:
            sql = postgres_sql(sql.replace('%', '%%'))
            return self.connection.execute(sql, params)
        return self.connection.execute(sql)


@contextmanager
def connect(database_url, sqlite_path):
    if database_url:
        if not database_url.startswith(('postgresql://', 'postgres://')):
            raise RuntimeError('DATABASE_URL must be a PostgreSQL connection URL.')
        # A failed external connection must NEVER fall back to an empty SQLite file.
        with psycopg.connect(database_url, connect_timeout=15, row_factory=record_factory,
                             prepare_threshold=None) as raw:
            raw.execute("SET LOCAL lock_timeout = '20s'")
            raw.execute("SET LOCAL statement_timeout = '30s'")
            raw.execute('SELECT pg_advisory_xact_lock(%s)', (TRANSACTION_LOCK,))
            yield PostgresConnection(raw)
        return
    Path(sqlite_path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(sqlite_path, timeout=20, isolation_level=None)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute('PRAGMA foreign_keys=ON')
        conn.execute('PRAGMA journal_mode=WAL')
        conn.execute('BEGIN IMMEDIATE')
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def initialize(database_url, sqlite_path):
    if database_url:
        with connect(database_url, sqlite_path) as conn:
            conn.execute(Path(__file__).with_name('schema_postgres.sql').read_text())
    else:
        Path(sqlite_path).parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(sqlite_path) as conn:
            conn.executescript(Path(__file__).with_name('schema.sql').read_text())
