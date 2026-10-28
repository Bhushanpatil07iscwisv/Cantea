from test_api import env
import app as module


def test_password_change_revokes_other_sessions(env):
    c, student, *_ = env
    other = c.post('/auth/login', json={'email':'s@test.com','password':'password123'}).json()['token']
    assert c.post('/me/password', headers=student, json={'current_password':'wrong','new_password':'newpassword123'}).status_code == 403
    assert c.post('/me/password', headers=student, json={'current_password':'password123','new_password':'newpassword123'}).status_code == 200
    assert c.get('/me', headers=student).status_code == 200
    assert c.get('/me', headers={'Authorization':'Bearer '+other}).status_code == 401
    assert c.post('/auth/login', json={'email':'s@test.com','password':'password123'}).status_code == 401
    assert c.post('/auth/login', json={'email':'s@test.com','password':'newpassword123'}).status_code == 200


def test_owner_setup_requires_private_key(env, monkeypatch):
    c, student, owner, *_ = env
    body = {'email':'ownera@test.com','password':'changedpassword123','name':'Owner','canteen_id':'a'}
    monkeypatch.setenv('OWNER_SETUP_TOKEN','private-test-token')
    assert c.post('/setup/owner', headers=student, json=body).status_code == 403
    headers = {'X-Setup-Token':'private-test-token'}
    assert c.post('/setup/owner', headers=headers, json={**body,'email':'s@test.com'}).status_code == 409
    assert c.post('/setup/owner', headers=headers, json=body).status_code == 200
    assert c.get('/me', headers=owner).status_code == 401
    assert c.post('/auth/login', json={'email':body['email'],'password':body['password']}).json()['user']['role'] == 'owner'


def test_new_web_setup_and_seed(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient
    monkeypatch.setattr(module,'DB_PATH',str(tmp_path/'empty.db'))
    monkeypatch.setenv('OWNER_SETUP_TOKEN','secret')
    module.init_db()
    c=TestClient(module.app)
    body={'email':'first@test.com','password':'password123','name':'First Owner'}
    assert c.post('/setup/owner',headers={'X-Setup-Token':'secret'},json=body).status_code == 200
    module.seed_extended_menu()
    with module.db() as conn:
        assert conn.execute('SELECT count(*) FROM menu').fetchone()[0] == 12
        assert conn.execute('SELECT sum(stock) FROM menu').fetchone()[0] == 0
        assert conn.execute('SELECT count(*) FROM slots').fetchone()[0] > 0
