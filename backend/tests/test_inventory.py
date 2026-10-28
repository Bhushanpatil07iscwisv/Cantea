from concurrent.futures import ThreadPoolExecutor
from test_api import env, order, stock
import app as module


def test_adjustments_authorization_and_retry(env):
    c, student, owner, *_ = env
    p = {'delta': 5, 'reason': 'Morning preparation', 'request_id': 'restock-001'}
    path = '/owner/inventory/meala/adjust'
    assert c.post(path, headers=student, json=p).status_code == 403
    assert c.post('/owner/inventory/mealb/adjust', headers=owner, json=p).status_code == 404
    for _ in range(2):
        assert c.post(path, headers=owner, json=p).json()['stock'] == 15
    assert c.post(path, headers=owner, json={**p, 'delta': 6}).status_code == 409
    assert c.post(path, headers=owner, json={**p, 'delta': -16, 'request_id': 'waste-001'}).status_code == 409
    assert stock() == 15
    history = c.get('/owner/inventory/history', headers=owner).json()
    assert history[0]['reason'] == 'Morning preparation'
    assert all(h['canteen_id'] == 'a' for h in history)
    assert c.get('/owner/inventory/history', headers=student).status_code == 403


def test_order_and_restock_are_atomic(env):
    c, _, owner, *_ = env
    def action(which):
        if which == 'order': return order(env, quantity=3).status_code
        return c.post('/owner/inventory/meala/adjust', headers=owner, json={
            'delta': 5, 'reason': 'Lunch preparation', 'request_id': 'parallel-001'}).status_code
    with ThreadPoolExecutor(2) as pool:
        assert list(pool.map(action, ['order', 'stock'])) == [200, 200]
    assert stock() == 12
    history = c.get('/owner/inventory/history', headers=owner).json()
    assert sum(h['delta'] for h in history) == 12


def test_suggestions_do_not_duplicate_or_reset(env):
    c, student, owner, *_ = env
    assert c.post('/owner/menu-suggestions', headers=student).status_code == 403
    assert c.post('/owner/menu-suggestions', headers=owner).json()['added'] == 12
    assert c.post('/owner/menu-suggestions', headers=owner).json()['added'] == 0
    items = c.get('/menu', headers=owner).json()
    assert len(items) == 13
    assert all(m['stock'] == 0 for m in items if m['id'] != 'meala')
    assert stock() == 10
    with module.db() as conn:
        assert conn.execute("SELECT count(*) FROM menu WHERE canteen_id='b'").fetchone()[0] == 1


def test_cross_canteen_delete_preserves_media(env):
    c, _, owner, *_ = env
    with module.db() as conn:
        conn.execute("INSERT INTO menu_media VALUES('mealb','image','description')")
    assert c.delete('/owner/menu/mealb', headers=owner).status_code == 404
    with module.db() as conn:
        assert conn.execute("SELECT description FROM menu_media WHERE menu_id='mealb'").fetchone()[0] == 'description'


def test_menu_edit_preserves_concurrent_order_stock(env):
    c, _, owner, *_ = env
    payload = {'name': 'Poha', 'category': 'Breakfast', 'price': 3500,
               'stock': 10, 'expected_stock': 10}
    assert order(env, quantity=2).status_code == 200
    assert c.put('/owner/menu/meala', headers=owner, json=payload).status_code == 200
    assert stock() == 8
    assert c.put('/owner/menu/meala', headers=owner, json={**payload, 'stock': 20}).status_code == 409
    assert stock() == 8
