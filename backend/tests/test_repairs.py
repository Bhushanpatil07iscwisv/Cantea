"""Regression checks for local startup, CORS, and owner schedule changes."""
from datetime import datetime, timedelta, timezone
import pytest
from test_api import env, order
import app as module

@pytest.mark.parametrize('origin', ['http://localhost:5173', 'http://127.0.0.1:5173'])
def test_browser_preflight(env, origin):
    c,*_=env
    r=c.options('/auth/register',headers={'Origin':origin,'Access-Control-Request-Method':'POST',
        'Access-Control-Request-Headers':'content-type,authorization,idempotency-key'})
    assert r.status_code==200
    assert r.headers['access-control-allow-origin']==origin

@pytest.mark.parametrize('changes', [
    {'open_time':'99:00'}, {'close_time':'08:00'}, {'closed_days':'Funday'},
    {'open_time':'10:00','close_time':'10:05','slot_duration':15},
])
def test_invalid_settings_are_rejected_without_crashing(env, changes):
    c,s,owner,*_=env
    settings={'open_time':'08:00','close_time':'17:00','slot_duration':15,'slot_capacity':20}
    settings.update(changes)
    assert c.put('/owner/settings',headers=owner,json=settings).status_code==422
    assert c.get('/slots/info',headers=s).status_code==200


def test_closed_canteen_blocks_new_orders(env):
    c,s,owner,*_=env
    payload={'open_time':'08:00','close_time':'17:00','slot_duration':15,'slot_capacity':20,'is_closed':True}
    assert c.put('/owner/settings',headers=owner,json=payload).status_code==200
    assert order(env).status_code==409


def test_schedule_change_preserves_booked_slot_and_removes_obsolete_empty_slots(env):
    c,s,owner,*_=env
    booking=order(env).json()
    with module.db() as conn:
        start=(datetime.now(timezone.utc)+timedelta(days=2)).isoformat()
        end=(datetime.now(timezone.utc)+timedelta(days=2,minutes=15)).isoformat()
        conn.execute('INSERT INTO slots VALUES(?,?,?,?,?)',('obsolete','a',start,end,10))
    payload={'open_time':'10:00','close_time':'12:00','slot_duration':30,'slot_capacity':25,'closed_days':''}
    assert c.put('/owner/settings',headers=owner,json=payload).status_code==200
    with module.db() as conn:
        assert conn.execute("SELECT 1 FROM slots WHERE id='slota'").fetchone()
        assert not conn.execute("SELECT 1 FROM slots WHERE id='obsolete'").fetchone()
    assert c.get('/orders',headers=s).json()[0]['id']==booking['id']


def test_packaged_site_and_api_alias(env):
    from fastapi.testclient import TestClient
    from server import app
    c=TestClient(app)
    assert c.get('/').status_code==200
    assert '<div id="root">' in c.get('/').text
    health = c.get('/api/health').json()
    assert health['status'] == 'ok'
    assert health['database'] == ('postgresql' if module.DATABASE_URL else 'sqlite')
    assert c.get('/health').json() == health
    assert c.get('/api/canteens').status_code==200
    assert c.get('/api/does-not-exist').status_code==404
    assert c.get('/backend/.env').status_code==404
    assert c.get('/api/me').status_code==401
