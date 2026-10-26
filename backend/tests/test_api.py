import hashlib,hmac,json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timedelta,timezone
import pytest
from fastapi.testclient import TestClient
import app as module

@pytest.fixture
def env(tmp_path,monkeypatch):
    monkeypatch.setattr(module,'DB_PATH',str(tmp_path/'test.db'));module.init_db()
    client=TestClient(module.app)
    with module.db() as c:
        for cid in ['a','b']:
            c.execute('INSERT INTO canteens(id,name,organization) VALUES(?,?,?)',(cid,cid,'College'))
            c.execute('INSERT INTO users(id,name,email,password,role,canteen_id) VALUES(?,?,?,?,?,?)',('owner'+cid,'Owner','owner'+cid+'@test.com',module.password_hash('password123'),'owner',cid))
            c.execute('INSERT INTO menu VALUES(?,?,?,?,?,?,?,?,?)',('meal'+cid,cid,'Poha','Breakfast',3000,10,1,1,'Peanuts'))
            c.execute('INSERT INTO slots VALUES(?,?,?,?,?)',('slot'+cid,cid,(datetime.now(timezone.utc)+timedelta(hours=1)).isoformat(),(datetime.now(timezone.utc)+timedelta(hours=2)).isoformat(),10))
    def signup(email,cid='a'):
        r=client.post('/auth/register',json={'name':'Student','email':email,'password':'password123','canteen_id':cid});assert r.status_code==200,r.text
        return {'Authorization':'Bearer '+r.json()['token']}
    student=signup('s@test.com');second=signup('s2@test.com');other=signup('b@test.com','b')
    owner={'Authorization':'Bearer '+client.post('/auth/login',json={'email':'ownera@test.com','password':'password123'}).json()['token']}
    return client,student,owner,second,other

def order(e,key='checkout-001',quantity=1,mode='cash',student=None):
    c,s,*_=e
    return c.post('/orders',headers={**(student or s),'Idempotency-Key':key},json={'items':[{'menu_id':'meala','quantity':quantity}],'slot_id':'slota','payment_mode':mode})
def stock():
    with module.db() as c:return c.execute("SELECT stock FROM menu WHERE id='meala'").fetchone()[0]
def test_complete_cash_order(env):
    c,s,owner,*_=env;o=order(env).json();path=f"/owner/orders/{o['id']}"
    assert o['total']==3000 and stock()==9
    assert c.post(path+'/status',headers=owner,json={'status':'ready'}).status_code==409
    for status in ['preparing','ready']:assert c.post(path+'/status',headers=owner,json={'status':status}).status_code==200
    assert c.post(path+'/status',headers=owner,json={'status':'collected','pickup_code':o['pickup_code']}).status_code==409
    assert c.post(path+'/cash',headers=owner).status_code==200
    assert c.post(path+'/status',headers=owner,json={'status':'collected','pickup_code':'wrong'}).status_code==422
    assert c.post(path+'/status',headers=owner,json={'status':'collected','pickup_code':o['pickup_code']}).status_code==200

def test_idempotency(env):
    a=order(env).json();b=order(env).json();assert a['id']==b['id'] and stock()==9
    assert order(env,quantity=2).status_code==409

@pytest.mark.parametrize('resource',['stock','capacity'])
def test_concurrency(env,resource):
    with module.db() as c:c.execute("UPDATE menu SET stock=1 WHERE id='meala'" if resource=='stock' else "UPDATE slots SET capacity=1 WHERE id='slota'")
    with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda k:order(env,key=k).status_code,['checkout-a','checkout-b']))
    assert sorted(results)==[200,409]
    assert stock()==(0 if resource=='stock' else 9)

def test_scope_and_roles(env):
    c,s,owner,second,other=env;o=order(env).json()
    assert c.get('/orders',headers=other).json()==[]
    assert c.post('/owner/menu',headers=s,json={'name':'Tea','category':'Drinks','price':1000,'stock':10}).status_code==403
    assert c.post('/orders/'+o['id']+'/cancel-request',headers=second,json={'reason':'Cancel'}).status_code==404
    assert order(env,key='cross-tenant',student=other).status_code==409

def test_edit_rollback(env):
    c,s,*_=env;o=order(env).json();path='/orders/'+o['id']+'/items'
    assert c.put(path,headers=s,json={'items':[{'menu_id':'meala','quantity':3}]}).status_code==200
    assert stock()==7
    assert c.put(path,headers=s,json={'items':[{'menu_id':'meala','quantity':20}]}).status_code==409
    assert stock()==7 and c.get('/orders',headers=s).json()[0]['total']==9000

def request_cancel(c,s,owner,oid):
    assert c.post('/orders/'+oid+'/cancel-request',headers=s,json={'reason':'Changed plans'}).status_code==200
    assert c.post('/owner/orders/'+oid+'/status',headers=owner,json={'status':'preparing'}).status_code==409
    assert c.post('/owner/orders/'+oid+'/cancel-decision',headers=owner,json={'approve':True}).status_code==200

def test_cancel_once(env):
    c,s,owner,*_=env;o=order(env).json();request_cancel(c,s,owner,o['id']);assert stock()==10
    assert c.post('/owner/orders/'+o['id']+'/cancel-decision',headers=owner,json={'approve':True}).status_code==409
    assert stock()==10

def test_no_cancel_after_preparation(env):
    c,s,owner,*_=env;o=order(env).json();c.post('/owner/orders/'+o['id']+'/status',headers=owner,json={'status':'preparing'})
    assert c.post('/orders/'+o['id']+'/cancel-request',headers=s,json={'reason':'Changed mind'}).status_code==409

def test_expiry(env):
    c,s,*_=env;o=order(env,mode='online').json()
    with module.db() as con:con.execute('UPDATE orders SET expires=0 WHERE id=?',(o['id'],))
    assert c.get('/orders',headers=s).json()[0]['status']=='cancelled'
    c.get('/orders',headers=s);assert stock()==10

def test_no_fake_payment(env,monkeypatch):
    monkeypatch.delenv('RAZORPAY_KEY_ID',raising=False);c,s,*_=env;o=order(env).json()
    assert c.post('/orders/'+o['id']+'/checkout',headers=s).status_code==503
    assert c.get('/orders',headers=s).json()[0]['payment_status']=='due'

def fake_checkout(env,monkeypatch):
    c,s,*_=env;o=order(env).json();monkeypatch.setattr(module,'provider',lambda *a,**kw:{'id':'order_gateway'})
    assert c.post('/orders/'+o['id']+'/checkout',headers=s).status_code==200
    return o

def test_checkout_locks(env,monkeypatch):
    c,s,owner,*_=env;o=fake_checkout(env,monkeypatch)
    assert c.put('/orders/'+o['id']+'/items',headers=s,json={'items':[{'menu_id':'meala','quantity':2}]}).status_code==409
    assert c.post('/owner/orders/'+o['id']+'/cash',headers=owner).status_code==409
    assert c.post('/owner/orders/'+o['id']+'/status',headers=owner,json={'status':'preparing'}).status_code==409

def webhook(c,secret,payment):
    body=json.dumps({'event':'payment.captured','payload':{'payment':{'entity':payment}}}).encode()
    return c.post('/payments/webhook',content=body,headers={'X-Razorpay-Signature':hmac.new(secret.encode(),body,hashlib.sha256).hexdigest(),'Content-Type':'application/json'})

def test_late_payment_and_replay(env,monkeypatch):
    c,s,owner,*_=env;o=fake_checkout(env,monkeypatch);monkeypatch.setenv('RAZORPAY_WEBHOOK_SECRET','secret')
    request_cancel(c,s,owner,o['id'])
    payment={'id':'pay_1','order_id':'order_gateway','amount':3000,'currency':'INR','status':'captured'}
    assert webhook(c,'secret',payment).status_code==200
    assert webhook(c,'secret',payment).status_code==200
    assert c.get('/orders',headers=s).json()[0]['payment_status']=='refund_due' and stock()==10

def test_invalid_payment(env,monkeypatch):
    c,s,*_=env;fake_checkout(env,monkeypatch);monkeypatch.setenv('RAZORPAY_WEBHOOK_SECRET','secret')
    payment={'id':'pay_1','order_id':'order_gateway','amount':1,'currency':'INR','status':'captured'}
    assert webhook(c,'wrong',payment).status_code==400
    assert webhook(c,'secret',payment).status_code==409
    assert c.get('/orders',headers=s).json()[0]['payment_status']=='due'

def test_verified_payment_refund(env,monkeypatch):
    c,s,owner,*_=env;o=fake_checkout(env,monkeypatch);monkeypatch.setenv('RAZORPAY_KEY_SECRET','secret')
    payment={'id':'pay_1','order_id':'order_gateway','amount':3000,'currency':'INR','status':'captured'}
    monkeypatch.setattr(module,'provider',lambda *a,**kw:payment)
    data={'razorpay_order_id':'order_gateway','razorpay_payment_id':'pay_1','razorpay_signature':hmac.new(b'secret',b'order_gateway|pay_1',hashlib.sha256).hexdigest()}
    assert c.post('/payments/verify',json=data).status_code==200
    request_cancel(c,s,owner,o['id']);path='/owner/orders/'+o['id']+'/refund-confirm'
    assert c.post(path,headers=owner,json={'reference':'rfnd_123'}).status_code==409
    monkeypatch.setattr(module,'provider',lambda *a,**kw:{'payment_id':'pay_1','amount':3000,'status':'processed'})
    assert c.post(path,headers=owner,json={'reference':'rfnd_123'}).status_code==200
    assert c.get('/orders',headers=s).json()[0]['payment_status']=='refunded'

def test_deletion(env):
    c,s,*_=env;assert c.delete('/me',headers=s).status_code==200
    assert c.get('/me',headers=s).status_code==401

def test_deletion_active(env):
    c,s,*_=env;order(env);assert c.delete('/me',headers=s).status_code==409

def test_login_throttle(env):
    c,*_=env
    for _ in range(10):assert c.post('/auth/login',json={'email':'unknown@test.com','password':'bad'}).status_code==401
    assert c.post('/auth/login',json={'email':'unknown@test.com','password':'bad'}).status_code==429

@pytest.mark.parametrize('quantity',[-1,True,1.5])
def test_quantity_validation(env,quantity):assert order(env,quantity=quantity).status_code==422

def test_slot_timezone(env):
    c,s,owner,*_=env
    assert c.post('/owner/slots',headers=owner,json={'starts':'2030-01-01T12:00:00','ends':'2030-01-01T12:15:00','capacity':10}).status_code==422


def test_rolling_slots_and_settings(env):
    c,s,owner,*_=env
    # Check slots info
    info = c.get('/slots/info', headers=s).json()
    assert 'canteen_name' in info and 'open_time' in info
    assert info['open_time'] == '08:00'

    # Get settings as owner
    settings = c.get('/owner/settings', headers=owner).json()
    assert settings['slot_duration'] == 15
    assert settings['slot_capacity'] == 20

    # Update settings
    res = c.put('/owner/settings', headers=owner, json={
        'open_time': '09:00',
        'close_time': '18:00',
        'slot_duration': 20,
        'slot_capacity': 25,
        'closed_days': 'Sunday',
        'is_closed': False,
        'closure_reason': ''
    })
    assert res.status_code == 200

    # Trigger manual slot generation
    gen = c.post('/owner/slots/generate', headers=owner, json={'days': 3})
    assert gen.status_code == 200
    assert gen.json()['total_future_slots'] > 0

    # Verify slots are returned with remaining > 0
    slots_resp = c.get('/slots', headers=s)
    assert slots_resp.status_code == 200
    slots_list = slots_resp.json()
    assert len(slots_list) > 0
    assert all(slot['remaining'] > 0 for slot in slots_list)


def test_owner_summary_and_menu_management(env):
    c,s,owner,*_=env
    # Check payment config
    pcfg = c.get('/payment-config').json()
    assert 'online_available' in pcfg

    # Add menu item with media
    res = c.post('/owner/menu', headers=owner, json={
        'name': 'Paneer Roll',
        'category': 'Snacks',
        'price': 5000,
        'stock': 15,
        'active': True,
        'vegetarian': True,
        'allergens': 'Milk, Gluten',
        'image_url': 'https://example.com/paneer.jpg',
        'description': 'Delicious grilled paneer roll'
    })
    assert res.status_code == 200
    mid = res.json()['id']

    # Update stock directly
    s_res = c.post(f'/owner/menu/{mid}/stock', headers=owner, json={'stock': 5})
    assert s_res.status_code == 200
    assert s_res.json()['stock'] == 5

    # Check menu contains image_url and description
    menu_items = c.get('/menu', headers=s).json()
    found = [m for m in menu_items if m['id'] == mid]
    assert len(found) == 1
    assert found[0]['image_url'] == 'https://example.com/paneer.jpg'
    assert found[0]['description'] == 'Delicious grilled paneer roll'

    # Check summary shows low stock item (stock is 5 <= 10)
    summ = c.get('/owner/summary', headers=owner).json()
    assert 'today_orders' in summ
    assert 'today_revenue' in summ
    assert 'low_stock_count' in summ
    assert summ['low_stock_count'] >= 1
    assert any(item['id'] == mid for item in summ['low_stock_items'])

    # Delete/archive menu item
    del_res = c.delete(f'/owner/menu/{mid}', headers=owner)
    assert del_res.status_code == 200

