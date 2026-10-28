import pytest
import app as module
from test_api import env, order
from database import connect, postgres_sql


def test_reinitialization_preserves_account_order_and_inventory(env):
    c, student, owner, *_ = env
    placed = order(env).json()
    module.init_db()
    module.init_db()
    assert c.get('/me', headers=student).status_code == 200
    assert c.get('/orders', headers=student).json()[0]['id'] == placed['id']
    with module.db() as conn:
        assert conn.execute("SELECT stock FROM menu WHERE id=?", ('meala',)).fetchone()[0] == 9
        history = conn.execute("SELECT count(*) FROM stock_movements WHERE menu_id=?", ('meala',)).fetchone()[0]
        assert history == 2  # Opening stock plus reservation; re-init doesn't duplicate either.
    payload = {'name': "Chef's special? 100%", 'category': 'Lunch', 'price': 5500, 'stock': 5}
    response = c.post('/owner/menu', headers=owner, json=payload)
    assert response.status_code == 200
    assert any(x['name'] == payload['name'] for x in c.get('/menu',headers=student).json())


def test_invalid_external_url_does_not_create_sqlite(tmp_path):
    path = tmp_path / 'must-not-be-created.db'
    with pytest.raises(RuntimeError, match='PostgreSQL'):
        with connect('https://incorrect-url', str(path)):
            pass
    assert not path.exists()


def test_sql_placeholders_preserve_quoted_question_marks():
    assert postgres_sql("SELECT '?' AS literal, ? AS value, 'it''s?' AS escaped") == "SELECT '?' AS literal, %s AS value, 'it''s?' AS escaped"
