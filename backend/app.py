"""Cantea pilot API. Money is stored in integer paise; writes are transactional."""
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime, timedelta, time as dt_time, timezone
from pathlib import Path
from typing import Literal
from zoneinfo import ZoneInfo

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field, model_validator

BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / '.env')
_db_path = Path(os.getenv('DB_PATH', 'cantea.db'))
DB_PATH = str(_db_path if _db_path.is_absolute() else BACKEND_DIR / _db_path)
BASE = os.getenv('PUBLIC_BASE_URL', 'http://localhost:8000').rstrip('/')
app = FastAPI(title='Cantea', version='0.1.0')

cors_env = os.getenv('CORS_ORIGINS', 'http://localhost:8081,http://localhost:19006')
allowed_origins = [o.strip() for o in cors_env.split(',') if o.strip()]
for dev_origin in ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:8080']:
    if dev_origin not in allowed_origins:
        allowed_origins.append(dev_origin)

app.add_middleware(CORSMiddleware, allow_origins=allowed_origins, allow_credentials=True,
                   allow_methods=['GET','POST','PUT','DELETE','OPTIONS','PATCH'],
                   allow_headers=['*'])


def fail(code, message):
    raise HTTPException(code, message)


def now():
    return int(time.time())


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def password_hash(password):
    salt = secrets.token_hex(16)
    return salt + ':' + hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1).hex()


def password_ok(password, stored):
    try:
        salt, expected = stored.split(':')
        result = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1).hex()
        return hmac.compare_digest(result, expected)
    except ValueError:
        return False


@contextmanager
def db():
    conn = sqlite3.connect(DB_PATH, timeout=20, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys=ON')
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('BEGIN IMMEDIATE')
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


DEFAULT_MEDIA = {
    'Poha': ('https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=600&auto=format&fit=crop&q=80', 'Flattened rice tempered with mustard seeds, turmeric, green chillies, fresh coriander and roasted peanuts.'),
    'Idli Sambar': ('https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80', 'Steamed fluffy rice-lentil cakes served with piping hot vegetable sambar and coconut chutney.'),
    'Veg Thali': ('https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=600&auto=format&fit=crop&q=80', 'Complete wholesome meal with paneer curry, yellow dal tadka, seasonal sabzi, 2 rotis, steamed rice, and salad.'),
    'Masala Chai': ('https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80', 'Freshly brewed strong Assam tea simmered with crushed cardamom, ginger, and aromatic spices.'),
    'Veg Sandwich': ('https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&auto=format&fit=crop&q=80', 'Toasted bread layered with crisp cucumber, ripe tomatoes, spiced potato stuffing, and mint chutney.')
}


def init_db():
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.executescript(Path(__file__).with_name('schema.sql').read_text())
        # Populate default meal media if missing
        for name, (img, desc) in DEFAULT_MEDIA.items():
            rows = conn.execute('SELECT id FROM menu WHERE name=?', (name,)).fetchall()
            for r in rows:
                conn.execute('INSERT OR IGNORE INTO menu_media(menu_id, image_url, description) VALUES(?,?,?)', (r[0], img, desc))



init_db()


def auth(conn, authorization, owner=False):
    if not authorization or not authorization.startswith('Bearer '):
        fail(401, 'Sign in required')
    row = conn.execute('''SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
        WHERE s.digest=? AND s.expires>? AND u.deleted=0''', (digest(authorization[7:]), now())).fetchone()
    if not row:
        fail(401, 'Session expired. Sign in again.')
    if owner and row['role'] != 'owner':
        fail(403, 'Owner access required')
    return row


def optional_auth(conn, authorization: str = '', canteen_id: str = ''):
    if authorization and authorization.startswith('Bearer '):
        row = conn.execute('''SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
            WHERE s.digest=? AND s.expires>? AND u.deleted=0''', (digest(authorization[7:]), now())).fetchone()
        if row:
            return row
    cid = canteen_id
    if not cid:
        first = conn.execute('SELECT id FROM canteens LIMIT 1').fetchone()
        cid = first['id'] if first else 'canteen-001'
    return {'id': None, 'name': 'Guest', 'email': '', 'role': 'guest', 'canteen_id': cid}


def audit(conn, actor, order, action):
    conn.execute('INSERT INTO audit(actor,order_id,action,created) VALUES(?,?,?,?)', (actor, order, action, now()))


def restore(conn, order):
    for item in conn.execute('SELECT * FROM order_items WHERE order_id=?', (order['id'],)).fetchall():
        conn.execute('UPDATE menu SET stock=stock+? WHERE id=?', (item['quantity'], item['menu_id']))


def cancel(conn, order, actor, reason):
    restore(conn, order)
    payment = 'refund_due' if order['payment_status'] == 'paid' else order['payment_status']
    conn.execute("UPDATE orders SET status='cancelled',payment_status=?,cancel_requested=0,cancel_reason=? WHERE id=?",
                 (payment, reason, order['id']))
    audit(conn, actor, order['id'], 'cancelled: ' + reason)


def expire(conn):
    rows = conn.execute("SELECT * FROM orders WHERE status='placed' AND payment_status='due' AND expires<?", (now(),)).fetchall()
    for order in rows:
        cancel(conn, order, 'system', 'Unpaid reservation expired')


def get_order(conn, order_id, user):
    row = conn.execute('SELECT * FROM orders WHERE id=? AND canteen_id=?', (order_id, user['canteen_id'])).fetchone()
    if not row or (user['role'] != 'owner' and row['user_id'] != user['id']):
        fail(404, 'Order not found')
    return row


def serialize_order(conn, order):
    result = dict(order)
    for key in ['fingerprint','idempotency','checkout_ticket','checkout_expires','provider_order','provider_payment']:
        result.pop(key, None)
    result['items'] = [dict(x) for x in conn.execute('SELECT * FROM order_items WHERE order_id=?', (order['id'],))]
    result['slot'] = dict(conn.execute('SELECT * FROM slots WHERE id=?', (order['slot_id'],)).fetchone())
    return result


class Register(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=5, max_length=160)
    password: str = Field(min_length=10, max_length=128)
    canteen_id: str


class Login(BaseModel):
    email: str = Field(max_length=160)
    password: str = Field(max_length=128)


def session(conn, user_id):
    token = secrets.token_urlsafe(32)
    conn.execute('INSERT INTO sessions VALUES(?,?,?)', (digest(token), user_id, now()+7*86400))
    user = dict(conn.execute('SELECT id,name,email,role,canteen_id FROM users WHERE id=?', (user_id,)).fetchone())
    return {'token': token, 'user': user}


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.get('/canteens')
def canteens():
    with db() as conn:
        return [dict(x) for x in conn.execute('SELECT * FROM canteens')]


@app.post('/auth/register')
def register(body: Register):
    email = body.email.strip().lower()
    if '@' not in email or '.' not in email.split('@')[-1]:
        fail(422, 'Enter a valid email')
    with db() as conn:
        if not conn.execute('SELECT 1 FROM canteens WHERE id=?', (body.canteen_id,)).fetchone():
            fail(404, 'Canteen not found')
        if conn.execute('SELECT 1 FROM users WHERE email=?', (email,)).fetchone():
            fail(409, 'Email already registered')
        uid = secrets.token_hex(16)
        conn.execute('INSERT INTO users(id,name,email,password,role,canteen_id) VALUES(?,?,?,?,?,?)',
                     (uid, body.name.strip(), email, password_hash(body.password), 'student', body.canteen_id))
        return session(conn, uid)


@app.post('/auth/login')
def login(body: Login, request: Request):
    bucket = digest((request.client.host if request.client else '') + body.email.strip().lower())
    # Persist failed attempts in a separate transaction, including on HTTP errors.
    with db() as conn:
        conn.execute('DELETE FROM login_attempts WHERE created<?', (now()-900,))
        count = conn.execute('SELECT count(*) FROM login_attempts WHERE bucket=?', (bucket,)).fetchone()[0]
        if count >= 10:
            fail(429, 'Too many attempts. Try again in 15 minutes.')
        conn.execute('INSERT INTO login_attempts VALUES(?,?)', (bucket, now()))
    with db() as conn:
        user = conn.execute('SELECT * FROM users WHERE email=? AND deleted=0', (body.email.strip().lower(),)).fetchone()
        if not user or not password_ok(body.password, user['password']):
            fail(401, 'Incorrect email or password')
        conn.execute('DELETE FROM login_attempts WHERE bucket=?', (bucket,))
        return session(conn, user['id'])


@app.post('/auth/logout')
def logout(authorization: str = Header(default='')):
    with db() as conn:
        auth(conn, authorization)
        conn.execute('DELETE FROM sessions WHERE digest=?', (digest(authorization[7:]),))
    return {'ok': True}


@app.get('/me')
def me(authorization: str = Header(default='')):
    with db() as conn:
        user = auth(conn, authorization)
        return {k: user[k] for k in ['id','name','email','role','canteen_id']}


@app.delete('/me')
def delete_me(authorization: str = Header(default='')):
    with db() as conn:
        user = auth(conn, authorization)
        if user['role'] == 'owner':
            fail(409, 'Contact support to transfer or close your canteen before deleting the owner account.')
        expire(conn)
        if conn.execute("SELECT 1 FROM orders WHERE user_id=? AND (status NOT IN ('collected','cancelled') OR payment_status='refund_due')", (user['id'],)).fetchone():
            fail(409, 'Complete or cancel active orders and settle refunds first.')
        conn.execute("UPDATE users SET name='Deleted user',email=?,password='',deleted=1 WHERE id=?", ('deleted-'+user['id']+'@invalid',user['id']))
        conn.execute('DELETE FROM sessions WHERE user_id=?', (user['id'],))
    return {'ok': True, 'message': 'Account anonymized. Transaction records retained for reconciliation.'}


def get_tz(name='Asia/Kolkata'):
    try:
        return ZoneInfo(name if name else 'Asia/Kolkata')
    except Exception:
        return timezone(timedelta(hours=5, minutes=30), name='IST')


def ensure_slots(conn, canteen_id: str, days: int = 7):
    canteen = conn.execute('SELECT * FROM canteens WHERE id=?', (canteen_id,)).fetchone()
    if not canteen:
        return 0
    settings = conn.execute('SELECT * FROM canteen_settings WHERE canteen_id=?', (canteen_id,)).fetchone()
    if not settings:
        conn.execute('INSERT OR IGNORE INTO canteen_settings(canteen_id) VALUES(?)', (canteen_id,))
        settings = conn.execute('SELECT * FROM canteen_settings WHERE canteen_id=?', (canteen_id,)).fetchone()

    if settings and settings['is_closed']:
        return 0

    open_time_str = settings['open_time'] if settings else '08:00'
    close_time_str = settings['close_time'] if settings else '17:00'
    slot_duration = settings['slot_duration'] if settings else 15
    slot_capacity = settings['slot_capacity'] if settings else 20
    closed_days = [d.strip().lower() for d in (settings['closed_days'] if settings else 'Sunday').split(',') if d.strip()]

    tz = get_tz(canteen['timezone'] if canteen['timezone'] else 'Asia/Kolkata')

    try:
        oh, om = [int(x) for x in open_time_str.split(':')]
        ch, cm = [int(x) for x in close_time_str.split(':')]
        open_minutes = oh * 60 + om
        close_minutes = ch * 60 + cm
    except Exception:
        open_minutes = 8 * 60
        close_minutes = 17 * 60

    if close_minutes <= open_minutes:
        close_minutes = open_minutes + 9 * 60

    now_local = datetime.now(tz)
    slots_created = 0

    for day_offset in range(days):
        current_date = (now_local + timedelta(days=day_offset)).date()
        day_name = current_date.strftime('%A').lower()
        if day_name in closed_days:
            continue

        minute = open_minutes
        while minute + slot_duration <= close_minutes:
            slot_start = datetime.combine(current_date, dt_time(minute // 60, minute % 60), tzinfo=tz)
            if slot_start <= now_local:
                minute += slot_duration
                continue

            slot_end = slot_start + timedelta(minutes=slot_duration)
            starts_utc = slot_start.astimezone(timezone.utc).isoformat()
            ends_utc = slot_end.astimezone(timezone.utc).isoformat()

            sid = secrets.token_hex(12)
            cur = conn.execute(
                'INSERT OR IGNORE INTO slots(id, canteen_id, starts, ends, capacity) VALUES(?,?,?,?,?)',
                (sid, canteen_id, starts_utc, ends_utc, slot_capacity)
            )
            if cur.rowcount > 0:
                slots_created += 1

            minute += slot_duration

    return slots_created


@app.get('/menu')
def menu(authorization: str = Header(default=''), canteen_id: str = Query(default='')):
    with db() as conn:
        user = optional_auth(conn, authorization, canteen_id)
        expire(conn)
        rows = conn.execute('''
            SELECT m.*, coalesce(mm.image_url, '') AS image_url, coalesce(mm.description, '') AS description
            FROM menu m
            LEFT JOIN menu_media mm ON mm.menu_id = m.id
            WHERE m.canteen_id=? AND (m.active=1 OR ?=1)
            ORDER BY m.category, m.name
        ''', (user['canteen_id'], int(user['role']=='owner'))).fetchall()
        return [dict(x) for x in rows]


@app.get('/slots')
def slots(authorization: str = Header(default=''), canteen_id: str = Query(default='')):
    with db() as conn:
        user = optional_auth(conn, authorization, canteen_id)
        expire(conn)
        future_count = conn.execute('SELECT count(*) FROM slots WHERE canteen_id=? AND starts>?',
                                    (user['canteen_id'], datetime.now(timezone.utc).isoformat())).fetchone()[0]
        if future_count < 10:
            ensure_slots(conn, user['canteen_id'], days=7)

        rows = conn.execute('''
            SELECT * FROM (
                SELECT s.*, s.capacity - (SELECT count(*) FROM orders o WHERE o.slot_id=s.id AND o.status!='cancelled') AS remaining
                FROM slots s WHERE canteen_id=? AND starts>?
            ) WHERE remaining > 0 ORDER BY starts
        ''', (user['canteen_id'], datetime.now(timezone.utc).isoformat())).fetchall()
        return [dict(x) for x in rows]


@app.get('/slots/info')
def slots_info(authorization: str = Header(default=''), canteen_id: str = Query(default='')):
    with db() as conn:
        user = optional_auth(conn, authorization, canteen_id)
        cid = user['canteen_id']
        canteen = conn.execute('SELECT * FROM canteens WHERE id=?', (cid,)).fetchone()
        if not canteen:
            fail(404, 'Canteen not found')
        settings = conn.execute('SELECT * FROM canteen_settings WHERE canteen_id=?', (cid,)).fetchone()

        future_count = conn.execute('SELECT count(*) FROM slots WHERE canteen_id=? AND starts>?',
                                    (cid, datetime.now(timezone.utc).isoformat())).fetchone()[0]
        if future_count < 10:
            ensure_slots(conn, cid, days=7)

        future_slots = conn.execute('''
            SELECT * FROM (
                SELECT s.*, s.capacity - (SELECT count(*) FROM orders o WHERE o.slot_id=s.id AND o.status!='cancelled') AS remaining
                FROM slots s WHERE canteen_id=? AND starts>?
            ) WHERE remaining > 0 ORDER BY starts
        ''', (cid, datetime.now(timezone.utc).isoformat())).fetchall()

        tz = get_tz(canteen['timezone'] if canteen['timezone'] else 'Asia/Kolkata')

        now_local = datetime.now(tz)
        open_time = settings['open_time'] if settings else '08:00'
        close_time = settings['close_time'] if settings else '17:00'
        is_closed = bool(settings['is_closed']) if settings else False
        closure_reason = settings['closure_reason'] if settings else ''
        closed_days = [d.strip().capitalize() for d in (settings['closed_days'] if settings else 'Sunday').split(',') if d.strip()]

        next_opening = None
        status_message = "Open"
        if is_closed:
            status_message = f"Temporarily closed: {closure_reason or 'Under maintenance'}"
        else:
            oh, om = [int(x) for x in open_time.split(':')]
            ch, cm = [int(x) for x in close_time.split(':')]
            open_min = oh * 60 + om
            close_min = ch * 60 + cm
            now_min = now_local.hour * 60 + now_local.minute
            today_day = now_local.strftime('%A')

            if today_day in closed_days:
                status_message = f"Closed today ({today_day})"
            elif now_min < open_min:
                status_message = f"Opens today at {open_time} IST"
                next_opening = now_local.replace(hour=oh, minute=om, second=0, microsecond=0).isoformat()
            elif now_min >= close_min:
                status_message = f"Closed for today (closed at {close_time} IST)"
            else:
                status_message = f"Open today until {close_time} IST"

        if not next_opening and (is_closed or len(future_slots) == 0 or status_message.startswith("Closed")):
            for day_offset in range(1, 8):
                cand = now_local + timedelta(days=day_offset)
                if cand.strftime('%A') not in closed_days:
                    oh, om = [int(x) for x in open_time.split(':')]
                    next_opening = cand.replace(hour=oh, minute=om, second=0, microsecond=0).isoformat()
                    break

        return {
            'canteen_name': canteen['name'],
            'timezone': canteen['timezone'],
            'open_time': open_time,
            'close_time': close_time,
            'slot_duration': settings['slot_duration'] if settings else 15,
            'slot_capacity': settings['slot_capacity'] if settings else 20,
            'closed_days': closed_days,
            'is_closed': is_closed,
            'closure_reason': closure_reason,
            'available_slots_count': len(future_slots),
            'next_opening': next_opening,
            'status_message': status_message,
            'earliest_slot': future_slots[0]['starts'] if future_slots else None
        }


@app.get('/payment-config')
def payment_config():
    key_id = os.getenv('RAZORPAY_KEY_ID', '')
    key_secret = os.getenv('RAZORPAY_KEY_SECRET', '')
    online_available = bool(key_id and key_secret)
    return {
        'online_available': online_available,
        'razorpay_key_id': key_id if online_available else None,
        'currency': 'INR'
    }


class Item(BaseModel):
    menu_id: str
    quantity: int = Field(strict=True, ge=1, le=20)


class OrderIn(BaseModel):
    slot_id: str
    items: list[Item] = Field(min_length=1, max_length=30)
    payment_mode: Literal['cash','online'] = 'cash'


def quote(conn, body, user):
    settings = conn.execute('SELECT is_closed FROM canteen_settings WHERE canteen_id=?', (user['canteen_id'],)).fetchone()
    if settings and settings['is_closed']:
        fail(409, 'The canteen is temporarily closed. Please try again after it reopens.')
    slot = conn.execute('SELECT * FROM slots WHERE id=? AND canteen_id=?', (body.slot_id,user['canteen_id'])).fetchone()
    if not slot or datetime.fromisoformat(slot['starts']).timestamp() <= now():
        fail(409, 'Choose a future pickup slot')
    used = conn.execute("SELECT count(*) FROM orders WHERE slot_id=? AND status!='cancelled'", (slot['id'],)).fetchone()[0]
    if used >= slot['capacity']:
        fail(409, 'Pickup slot is full')
    if len({i.menu_id for i in body.items}) != len(body.items):
        fail(422, 'Duplicate menu items')
    rows, total = [], 0
    for item in body.items:
        row = conn.execute('SELECT * FROM menu WHERE id=? AND canteen_id=? AND active=1', (item.menu_id,user['canteen_id'])).fetchone()
        if not row or row['stock'] < item.quantity:
            fail(409, 'An item is unavailable or has insufficient stock')
        rows.append((row,item.quantity))
        total += row['price'] * item.quantity
    return slot, rows, total


@app.post('/orders')
def create_order(body: OrderIn, authorization: str = Header(default=''), idempotency_key: str = Header(min_length=8,max_length=100)):
    fingerprint = digest(json.dumps(body.model_dump(),sort_keys=True))
    with db() as conn:
        user = auth(conn,authorization)
        expire(conn)
        previous = conn.execute('SELECT * FROM orders WHERE user_id=? AND idempotency=?', (user['id'],idempotency_key)).fetchone()
        if previous:
            if previous['fingerprint'] != fingerprint:
                fail(409, 'This checkout key was already used with a different cart')
            return serialize_order(conn,previous)
        active = conn.execute("SELECT count(*) FROM orders WHERE user_id=? AND status IN ('placed','preparing','ready')", (user['id'],)).fetchone()[0]
        if active >= 5:
            fail(409, 'Finish an existing order before creating another')
        slot, rows, total = quote(conn,body,user)
        oid = secrets.token_hex(16)
        token = 'CT-' + secrets.token_hex(5).upper()
        expiry = now()+600 if body.payment_mode == 'online' else int(datetime.fromisoformat(slot['ends']).timestamp())+900
        conn.execute('''INSERT INTO orders(id,user_id,canteen_id,slot_id,token,pickup_code,payment_mode,total,created,expires,idempotency,fingerprint)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?)''',
            (oid,user['id'],user['canteen_id'],slot['id'],token,secrets.token_hex(3).upper(),body.payment_mode,total,now(),expiry,idempotency_key,fingerprint))
        for row, quantity in rows:
            conn.execute('UPDATE menu SET stock=stock-? WHERE id=?',(quantity,row['id']))
            conn.execute('INSERT INTO order_items VALUES(?,?,?,?,?)',(oid,row['id'],row['name'],row['price'],quantity))
        audit(conn,user['id'],oid,'created')
        return serialize_order(conn,get_order(conn,oid,user))


@app.get('/orders')
def orders(authorization: str = Header(default='')):
    with db() as conn:
        user = auth(conn,authorization)
        expire(conn)
        rows = conn.execute('''SELECT * FROM orders WHERE canteen_id=? AND (?='owner' OR user_id=?) ORDER BY created DESC LIMIT 200''',
                            (user['canteen_id'],user['role'],user['id'])).fetchall()
        return [serialize_order(conn,row) for row in rows]


class EditItems(BaseModel):
    items: list[Item] = Field(min_length=1,max_length=30)


@app.put('/orders/{oid}/items')
def edit_items(oid: str, body: EditItems, authorization: str = Header(default='')):
    with db() as conn:
        user = auth(conn,authorization)
        expire(conn)
        order = get_order(conn,oid,user)
        if order['user_id'] != user['id']:
            fail(403,'Only the customer can change the cart')
        if order['status'] != 'placed' or order['payment_status'] != 'due' or order['provider_order'] or order['cancel_requested']:
            fail(409,'Cart is locked. Place a separate order for extras, or request cancellation.')
        # Free this reservation inside the same transaction, then validate the replacement.
        restore(conn,order)
        conn.execute("UPDATE orders SET status='cancelled' WHERE id=?",(oid,))
        _,rows,total = quote(conn,OrderIn(slot_id=order['slot_id'],items=body.items),user)
        conn.execute('DELETE FROM order_items WHERE order_id=?',(oid,))
        for row,quantity in rows:
            conn.execute('UPDATE menu SET stock=stock-? WHERE id=?',(quantity,row['id']))
            conn.execute('INSERT INTO order_items VALUES(?,?,?,?,?)',(oid,row['id'],row['name'],row['price'],quantity))
        conn.execute("UPDATE orders SET total=?,status='placed' WHERE id=?",(total,oid))
        audit(conn,user['id'],oid,'cart updated')
        return serialize_order(conn,get_order(conn,oid,user))


class Reason(BaseModel):
    reason: str = Field(min_length=3,max_length=250)


@app.post('/orders/{oid}/cancel-request')
def cancel_request(oid: str, body: Reason, authorization: str = Header(default='')):
    with db() as conn:
        user = auth(conn,authorization)
        order = get_order(conn,oid,user)
        if order['user_id'] != user['id']:
            fail(403,'Only the customer can request cancellation')
        if order['status'] != 'placed':
            fail(409,'Cancellation is only available before preparation begins')
        conn.execute('UPDATE orders SET cancel_requested=1,cancel_reason=? WHERE id=?',(body.reason,oid))
        audit(conn,user['id'],oid,'cancellation requested')
    return {'ok':True}


class Decision(BaseModel):
    approve: bool


@app.post('/owner/orders/{oid}/cancel-decision')
def cancel_decision(oid: str, body: Decision, authorization: str = Header(default='')):
    with db() as conn:
        user = auth(conn,authorization,True)
        order = get_order(conn,oid,user)
        if order['status'] != 'placed' or not order['cancel_requested']:
            fail(409,'No pending cancellation')
        if body.approve:
            cancel(conn,order,user['id'],order['cancel_reason'])
        else:
            conn.execute('UPDATE orders SET cancel_requested=0 WHERE id=?',(oid,))
            audit(conn,user['id'],oid,'cancellation rejected')
    return {'ok':True}


class StatusIn(BaseModel):
    status: Literal['preparing','ready','collected']
    pickup_code: str = ''


@app.post('/owner/orders/{oid}/status')
def change_status(oid: str, body: StatusIn, authorization: str = Header(default='')):
    with db() as conn:
        user = auth(conn,authorization,True)
        expire(conn)
        order = get_order(conn,oid,user)
        if {'placed':'preparing','preparing':'ready','ready':'collected'}.get(order['status']) != body.status:
            fail(409,'Invalid order transition')
        if order['cancel_requested']:
            fail(409,'Resolve the cancellation request first')
        if order['payment_mode']=='online' and order['payment_status']!='paid':
            fail(409,'Wait for confirmed online payment')
        if body.status=='collected':
            if order['payment_status']!='paid':
                fail(409,'Collect and record payment first')
            if not hmac.compare_digest(body.pickup_code.upper(),order['pickup_code']):
                fail(422,'Incorrect collection code')
        conn.execute('UPDATE orders SET status=? WHERE id=?',(body.status,oid))
        audit(conn,user['id'],oid,body.status)
    return {'ok':True}


@app.post('/owner/orders/{oid}/cash')
def record_cash(oid: str, authorization: str = Header(default='')):
    with db() as conn:
        user = auth(conn,authorization,True)
        expire(conn)
        order = get_order(conn,oid,user)
        if order['payment_status']=='paid':
            return {'ok':True}
        if order['status'] not in ('placed','preparing','ready') or order['provider_order']:
            fail(409,'Order cancelled or online checkout already started')
        conn.execute("UPDATE orders SET payment_mode='cash',payment_status='paid' WHERE id=?",(oid,))
        audit(conn,user['id'],oid,'cash received')
    return {'ok':True}


class MenuIn(BaseModel):
    expected_stock: int | None = Field(default=None, strict=True, ge=0)
    name: str = Field(min_length=2,max_length=80)
    category: str = Field(min_length=2,max_length=30)
    price: int = Field(strict=True,ge=100,le=100000)
    stock: int = Field(strict=True,ge=0,le=100000)
    active: bool = True
    vegetarian: bool = True
    allergens: str = Field(default='',max_length=200)
    image_url: str = Field(default='',max_length=500)
    description: str = Field(default='',max_length=500)


@app.post('/owner/menu')
def add_menu(body: MenuIn, authorization: str = Header(default='')):
    with db() as conn:
        user = auth(conn,authorization,True)
        mid=secrets.token_hex(12)
        conn.execute('INSERT INTO menu VALUES(?,?,?,?,?,?,?,?,?)',(mid,user['canteen_id'],body.name,body.category,body.price,body.stock,int(body.active),int(body.vegetarian),body.allergens))
        if body.image_url or body.description:
            conn.execute('INSERT OR REPLACE INTO menu_media(menu_id,image_url,description) VALUES(?,?,?)', (mid, body.image_url, body.description))
    return {'id':mid}


@app.put('/owner/menu/{mid}')
def update_menu(mid: str, body: MenuIn, authorization: str = Header(default='')):
    with db() as conn:
        user = auth(conn,authorization,True)
        current = conn.execute('SELECT stock FROM menu WHERE id=? AND canteen_id=?', (mid, user['canteen_id'])).fetchone()
        if not current:
            fail(404, 'Item not found')
        if body.expected_stock is not None:
            if body.stock == body.expected_stock:
                body.stock = current['stock']
            elif current['stock'] != body.expected_stock:
                fail(409, 'Stock changed while you were editing. Reopen the meal and try again.')
        row = conn.execute('UPDATE menu SET name=?,category=?,price=?,stock=?,active=?,vegetarian=?,allergens=? WHERE id=? AND canteen_id=?',
            (body.name,body.category,body.price,body.stock,int(body.active),int(body.vegetarian),body.allergens,mid,user['canteen_id']))
        if row.rowcount!=1:
            fail(404,'Item not found')
        conn.execute('INSERT OR REPLACE INTO menu_media(menu_id,image_url,description) VALUES(?,?,?)', (mid, body.image_url, body.description))
        audit(conn,user['id'],None,'menu updated: '+mid)
    return {'ok':True}


@app.delete('/owner/menu/{mid}')
def delete_menu(mid: str, authorization: str = Header(default='')):
    with db() as conn:
        user = auth(conn,authorization,True)
        if not conn.execute('SELECT 1 FROM menu WHERE id=? AND canteen_id=?', (mid, user['canteen_id'])).fetchone():
            fail(404, 'Item not found')
        in_orders = conn.execute('SELECT 1 FROM order_items WHERE menu_id=?', (mid,)).fetchone()
        if in_orders:
            conn.execute('UPDATE menu SET active=0 WHERE id=? AND canteen_id=?', (mid, user['canteen_id']))
            msg = 'Item archived to protect order history'
        else:
            conn.execute('DELETE FROM menu_media WHERE menu_id=?', (mid,))
            conn.execute('DELETE FROM menu WHERE id=? AND canteen_id=?', (mid, user['canteen_id']))
            msg = 'Item deleted'
        audit(conn,user['id'],None,'menu deleted/archived: '+mid)
    return {'ok':True, 'message': msg}


class StockIn(BaseModel):
    stock: int = Field(strict=True, ge=0, le=100000)


@app.post('/owner/menu/{mid}/stock')
def update_stock(mid: str, body: StockIn, authorization: str = Header(default='')):
    with db() as conn:
        user = auth(conn,authorization,True)
        row = conn.execute('UPDATE menu SET stock=? WHERE id=? AND canteen_id=?', (body.stock, mid, user['canteen_id']))
        if row.rowcount != 1:
            fail(404, 'Item not found')
        audit(conn,user['id'],None,f'stock updated for {mid}: {body.stock}')
    return {'ok':True, 'stock': body.stock}


class SlotIn(BaseModel):
    starts: datetime
    ends: datetime
    capacity: int = Field(strict=True,ge=1,le=500)


@app.post('/owner/slots')
def add_slot(body: SlotIn, authorization: str = Header(default='')):
    if not body.starts.tzinfo or not body.ends.tzinfo or body.ends<=body.starts or body.starts.timestamp()<=now():
        fail(422,'Use future timezone-aware start/end times')
    with db() as conn:
        user=auth(conn,authorization,True)
        sid=secrets.token_hex(12)
        try:
            conn.execute('INSERT INTO slots VALUES(?,?,?,?,?)',(sid,user['canteen_id'],body.starts.astimezone(timezone.utc).isoformat(),body.ends.astimezone(timezone.utc).isoformat(),body.capacity))
        except sqlite3.IntegrityError:
            fail(409,'A slot already starts at that time')
    return {'id':sid}


class GenerateSlotsIn(BaseModel):
    days: int = Field(default=7, ge=1, le=30)


@app.post('/owner/slots/generate')
def generate_slots(body: GenerateSlotsIn = GenerateSlotsIn(), authorization: str = Header(default='')):
    with db() as conn:
        user = auth(conn,authorization,True)
        created = ensure_slots(conn, user['canteen_id'], days=body.days)
        total = conn.execute('SELECT count(*) FROM slots WHERE canteen_id=? AND starts>?',
                             (user['canteen_id'], datetime.now(timezone.utc).isoformat())).fetchone()[0]
    return {'ok':True, 'created': created, 'total_future_slots': total}


class SettingsIn(BaseModel):
    open_time: str = Field(pattern=r'^\d{2}:\d{2}$')
    close_time: str = Field(pattern=r'^\d{2}:\d{2}$')
    slot_duration: int = Field(ge=5, le=120)
    slot_capacity: int = Field(ge=1, le=500)
    closed_days: str = Field(default='', max_length=100)
    is_closed: bool = False
    closure_reason: str = Field(default='', max_length=200)


    @model_validator(mode='after')
    def valid_schedule(self):
        try:
            opening = dt_time.fromisoformat(self.open_time)
            closing = dt_time.fromisoformat(self.close_time)
        except ValueError:
            raise ValueError('Enter valid times between 00:00 and 23:59')
        if closing <= opening:
            raise ValueError('Closing time must be after opening time')
        duration = (closing.hour * 60 + closing.minute) - (opening.hour * 60 + opening.minute)
        if duration < self.slot_duration:
            raise ValueError('Opening hours must fit at least one pickup slot')
        days = [d.strip().capitalize() for d in self.closed_days.split(',') if d.strip()]
        if any(d not in {'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'} for d in days):
            raise ValueError('Use weekday names separated by commas')
        self.closed_days = ','.join(dict.fromkeys(days))
        return self


@app.get('/owner/settings')
def get_settings(authorization: str = Header(default='')):
    with db() as conn:
        user = auth(conn,authorization,True)
        canteen = conn.execute('SELECT * FROM canteens WHERE id=?', (user['canteen_id'],)).fetchone()
        settings = conn.execute('SELECT * FROM canteen_settings WHERE canteen_id=?', (user['canteen_id'],)).fetchone()
        return {
            'canteen_id': user['canteen_id'],
            'name': canteen['name'],
            'organization': canteen['organization'],
            'kind': canteen['kind'],
            'timezone': canteen['timezone'],
            'open_time': settings['open_time'] if settings else '08:00',
            'close_time': settings['close_time'] if settings else '17:00',
            'slot_duration': settings['slot_duration'] if settings else 15,
            'slot_capacity': settings['slot_capacity'] if settings else 20,
            'closed_days': settings['closed_days'] if settings else 'Sunday',
            'is_closed': bool(settings['is_closed']) if settings else False,
            'closure_reason': settings['closure_reason'] if settings else ''
        }


@app.put('/owner/settings')
def update_settings(body: SettingsIn, authorization: str = Header(default='')):
    with db() as conn:
        user = auth(conn,authorization,True)
        conn.execute('''
            INSERT OR REPLACE INTO canteen_settings(canteen_id, open_time, close_time, slot_duration, slot_capacity, closed_days, is_closed, closure_reason)
            VALUES(?,?,?,?,?,?,?,?)
        ''', (user['canteen_id'], body.open_time, body.close_time, body.slot_duration, body.slot_capacity, body.closed_days, int(body.is_closed), body.closure_reason))
        conn.execute('''DELETE FROM slots WHERE canteen_id=? AND starts>?
            AND NOT EXISTS (SELECT 1 FROM orders WHERE orders.slot_id=slots.id)''',
            (user['canteen_id'], datetime.now(timezone.utc).isoformat()))
        ensure_slots(conn, user['canteen_id'], days=7)
        audit(conn, user['id'], None, 'settings updated')
    return {'ok':True}


@app.get('/owner/summary')
def summary(authorization: str = Header(default='')):
    with db() as conn:
        user=auth(conn,authorization,True)
        cid = user['canteen_id']
        expire(conn)

        basic = dict(conn.execute("""SELECT count(*) AS total_orders,
            coalesce(sum(CASE WHEN payment_status='paid' THEN total ELSE 0 END),0) AS total_revenue,
            coalesce(sum(CASE WHEN payment_status='refund_due' THEN total ELSE 0 END),0) AS refund_due_amount,
            coalesce(sum(CASE WHEN status IN ('placed','preparing','ready') THEN 1 ELSE 0 END),0) AS active_orders,
            coalesce(sum(CASE WHEN status='placed' AND cancel_requested=1 THEN 1 ELSE 0 END),0) AS cancellation_requests
            FROM orders WHERE canteen_id=?""", (cid,)).fetchone())

        tz = get_tz('Asia/Kolkata')
        now_ist = datetime.now(tz)
        start_of_day_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
        start_of_day_epoch = int(start_of_day_ist.timestamp())

        today = dict(conn.execute("""SELECT count(*) AS today_orders,
            coalesce(sum(CASE WHEN payment_status='paid' THEN total ELSE 0 END),0) AS today_revenue
            FROM orders WHERE canteen_id=? AND created>=?""", (cid, start_of_day_epoch)).fetchone())

        low_stock_rows = conn.execute("""SELECT id, name, category, stock, price
            FROM menu WHERE canteen_id=? AND active=1 AND stock<=10 ORDER BY stock ASC""", (cid,)).fetchall()
        low_stock_items = [dict(r) for r in low_stock_rows]

        return {
            'orders': basic['total_orders'],
            'paid': basic['total_revenue'],
            'refund_due': basic['refund_due_amount'],
            'total_orders': basic['total_orders'],
            'total_revenue': basic['total_revenue'],
            'today_orders': today['today_orders'],
            'today_revenue': today['today_revenue'],
            'active_orders': basic['active_orders'],
            'cancellation_requests': basic['cancellation_requests'],
            'low_stock_count': len(low_stock_items),
            'low_stock_items': low_stock_items
        }


def provider(method,path,payload=None):
    key,secret=os.getenv('RAZORPAY_KEY_ID'),os.getenv('RAZORPAY_KEY_SECRET')
    if not key or not secret:
        fail(503,'Online payment is not configured. Use pay at counter.')
    try:
        response=httpx.request(method,'https://api.razorpay.com/v1/'+path,auth=(key,secret),json=payload,timeout=15)
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError,ValueError):
        fail(502,'Payment provider unavailable. Retry shortly.')


@app.post('/orders/{oid}/checkout')
def checkout(oid: str, authorization: str = Header(default='')):
    with db() as conn:
        user=auth(conn,authorization)
        expire(conn)
        order=get_order(conn,oid,user)
        if order['user_id']!=user['id'] or order['status']!='placed' or order['payment_status']!='due' or order['cancel_requested']:
            fail(409,'Order is not payable')
        provider_id=order['provider_order']
        if not provider_id:
            payment=provider('POST','orders',{'amount':order['total'],'currency':'INR','receipt':oid})
            provider_id=payment['id']
        ticket=secrets.token_urlsafe(32)
        conn.execute("UPDATE orders SET provider_order=?,payment_mode='online',checkout_ticket=?,checkout_expires=?,expires=? WHERE id=?",
                     (provider_id,digest(ticket),now()+600,now()+600,oid))
    return {'url':BASE+'/pay/'+ticket}


@app.get('/pay/{ticket}',response_class=HTMLResponse)
def payment_page(ticket: str):
    with db() as conn:
        order=conn.execute("SELECT * FROM orders WHERE checkout_ticket=? AND checkout_expires>? AND status='placed' AND payment_status='due'",(digest(ticket),now())).fetchone()
        if not order:
            fail(410,'Checkout expired. Return to Cantea.')
        config=json.dumps({'key':os.getenv('RAZORPAY_KEY_ID'),'order_id':order['provider_order'],'amount':order['total'],
                          'currency':'INR','name':'Cantea','description':'Canteen pickup order','theme':{'color':'#1B5747'}})
    return '''<!doctype html><html><meta name="viewport" content="width=device-width, initial-scale=1"><title>Cantea payment</title>
    <body style="font:20px system-ui;padding:40px;background:#f7f5ed"><h1>Cantea</h1><p id="message">Pay securely, then return to the app.</p>
    <a href="/" style="display:block;margin-bottom:20px">Return to Cantea</a><button id="pay" style="padding:20px">Pay now</button><script src="https://checkout.razorpay.com/v1/checkout.js"></script><script>
    const options='''+config+'''; options.handler=async function(result){
      const response=await fetch(new URL('../payments/verify', location.href),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(result)});
      const data=await response.json(); document.getElementById('message').textContent=response.ok?'Payment checked. Return to Cantea and refresh.':(data.detail||'Verification pending. Return to the app.');
    }; document.getElementById('pay').onclick=()=>new Razorpay(options).open();</script></body></html>'''


def captured(conn,payment):
    order=conn.execute('SELECT * FROM orders WHERE provider_order=?',(payment.get('order_id'),)).fetchone()
    if not order or payment.get('status')!='captured' or payment.get('amount')!=order['total'] or payment.get('currency')!='INR':
        fail(409,'Payment amount, order or captured status does not match')
    if order['provider_payment']:
        if order['provider_payment']!=payment['id']:
            fail(409,'Unexpected second payment. Contact support.')
        return
    state='refund_due' if order['status']=='cancelled' else 'paid'
    conn.execute('UPDATE orders SET payment_status=?,provider_payment=? WHERE id=?',(state,payment['id'],order['id']))
    audit(conn,'razorpay',order['id'],'payment captured')


class Verify(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@app.post('/payments/verify')
def verify(body: Verify):
    secret=os.getenv('RAZORPAY_KEY_SECRET','')
    if not secret:
        fail(503,'Payments unavailable')
    expected=hmac.new(secret.encode(),(body.razorpay_order_id+'|'+body.razorpay_payment_id).encode(),hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected,body.razorpay_signature):
        fail(400,'Invalid payment signature')
    payment=provider('GET','payments/'+body.razorpay_payment_id)
    if payment.get('order_id')!=body.razorpay_order_id:
        fail(409,'Payment order mismatch')
    with db() as conn:
        captured(conn,payment)
    return {'ok':True}


@app.post('/payments/webhook')
async def webhook(request: Request, x_razorpay_signature: str = Header(default='')):
    raw=await request.body()
    secret=os.getenv('RAZORPAY_WEBHOOK_SECRET','')
    if not secret or not hmac.compare_digest(hmac.new(secret.encode(),raw,hashlib.sha256).hexdigest(),x_razorpay_signature):
        fail(400,'Invalid webhook signature')
    try:
        event=json.loads(raw)
        if event.get('event')=='payment.captured':
            payment=event['payload']['payment']['entity']
            with db() as conn:
                captured(conn,payment)
    except (ValueError,KeyError,TypeError):
        fail(400,'Invalid webhook payload')
    return {'ok':True}


class Refund(BaseModel):
    reference: str = Field(min_length=5,max_length=100)


@app.post('/owner/orders/{oid}/refund-confirm')
def refund_confirm(oid: str, body: Refund, authorization: str = Header(default='')):
    # Refunds are performed in the gateway dashboard (or returned cash), then reconciled here.
    with db() as conn:
        user=auth(conn,authorization,True)
        order=get_order(conn,oid,user)
        if order['payment_status']!='refund_due':
            fail(409,'No refund is due')
        if order['provider_payment']:
            refund=provider('GET','refunds/'+body.reference)
            if refund.get('payment_id')!=order['provider_payment'] or refund.get('amount')!=order['total'] or refund.get('status')!='processed':
                fail(409,'Refund is not fully processed for this payment')
        conn.execute("UPDATE orders SET payment_status='refunded',refund_reference=? WHERE id=?",(body.reference,oid))
        audit(conn,user['id'],oid,'refund confirmed: '+body.reference)
    return {'ok':True}


@app.get('/privacy',response_class=HTMLResponse)
def privacy():
    import html
    email=html.escape(os.getenv('SUPPORT_EMAIL','replace-me@example.com'))
    return f'''<html><meta name="viewport" content="width=device-width"><title>Cantea privacy draft</title><body style="font:18px system-ui;max-width:700px;margin:40px auto;padding:20px">
    <h1>Cantea privacy notice: deployment draft</h1><p>The operator must finalize this notice before public release.</p>
    <p>Cantea stores your name, email, password hash, login sessions and food-order/payment references to operate canteen pickup.
    Razorpay processes online payments; Cantea does not store card numbers. No location, contacts or camera permission is needed.</p>
    <p>Your canteen owner can view your orders. Contact {email} for access or deletion requests. Account deletion is available inside Settings.
    Personal profile details and sessions are removed on deletion; anonymized transaction records remain for reconciliation. The operator must define and implement a retention period before launch.</p>
    <a href="/delete-account">Account deletion</a></body></html>'''


@app.get('/delete-account',response_class=HTMLResponse)
def deletion_page():
    import html
    email=html.escape(os.getenv('SUPPORT_EMAIL','replace-me@example.com'))
    return f'''<html><meta name="viewport" content="width=device-width"><title>Delete Cantea account</title><body style="font:18px system-ui;padding:30px"><h1>Delete your Cantea account</h1>
    <p>In Cantea, open Account and choose Delete account after orders and refunds are settled.</p>
    <p>If you cannot sign in, email <a href="mailto:{email}">{email}</a> with subject Cantea account deletion. The operator will verify ownership and handle the request.
    Profile details and sessions are removed; anonymized transaction records are retained for reconciliation. See the privacy notice for the operator's retention terms.</p></body></html>'''


class StockAdjustmentIn(BaseModel):
    delta: int = Field(strict=True, ge=-100000, le=100000)
    reason: str = Field(min_length=3, max_length=200)
    request_id: str = Field(min_length=8, max_length=100)


@app.get('/owner/inventory/history')
def inventory_history(authorization: str = Header(default='')):
    with db() as conn:
        user = auth(conn, authorization, True)
        return [dict(row) for row in conn.execute(
            'SELECT * FROM stock_movements WHERE canteen_id=? ORDER BY id DESC LIMIT 100',
            (user['canteen_id'],)).fetchall()]


@app.post('/owner/inventory/{mid}/adjust')
def adjust_inventory(mid: str, body: StockAdjustmentIn, authorization: str = Header(default='')):
    if not body.delta or not body.reason.strip():
        fail(422, 'Enter a non-zero quantity and a reason')
    with db() as conn:
        user = auth(conn, authorization, True)
        row = conn.execute('SELECT * FROM menu WHERE id=? AND canteen_id=?',
                           (mid, user['canteen_id'])).fetchone()
        if not row:
            fail(404, 'Item not found')
        key = 'inventory:' + body.request_id
        previous = conn.execute('SELECT action FROM audit WHERE actor=? AND order_id=?',
                                (user['id'], key)).fetchone()
        payload = json.dumps([mid, body.delta, body.reason.strip()])
        if previous:
            if previous['action'] != payload:
                fail(409, 'This request identifier was already used')
            return {'stock': row['stock']}
        balance = row['stock'] + body.delta
        if balance < 0 or balance > 100000:
            fail(409, 'Adjustment exceeds available stock or the stock limit. Refresh and try again.')
        conn.execute('UPDATE menu SET stock=? WHERE id=?', (balance, mid))
        conn.execute('UPDATE stock_movements SET reason=?,actor=? WHERE id=(SELECT max(id) FROM stock_movements WHERE menu_id=?)',
                     (body.reason.strip(), user['id'], mid))
        audit(conn, user['id'], key, payload)
        return {'stock': balance}


EXTRA_MENU = [
    ('Upma', 'Breakfast', 3000, 'Warm semolina with vegetables and curry leaves.', 'Wheat'),
    ('Misal Pav', 'Breakfast', 6000, 'Spiced sprouts with farsan and two pav.', 'Wheat'),
    ('Medu Vada', 'Breakfast', 4000, 'Two crisp lentil vadas with chutney.', ''),
    ('Masala Dosa', 'Breakfast', 6500, 'Rice dosa with potato filling, sambar and chutney.', ''),
    ('Aloo Paratha', 'Breakfast', 5000, 'Potato-stuffed paratha with curd.', 'Wheat, Milk'),
    ('Dal Khichdi', 'Lunch', 7000, 'Rice and lentils cooked with mild spices.', ''),
    ('Rajma Rice', 'Lunch', 8000, 'Kidney bean curry with steamed rice.', ''),
    ('Veg Pulao', 'Lunch', 6500, 'Rice cooked with vegetables and whole spices.', ''),
    ('Vada Pav', 'Snacks', 2000, 'Potato vada in pav with dry garlic chutney.', 'Wheat, Peanuts'),
    ('Samosa', 'Snacks', 2000, 'Crisp pastry with a spiced potato filling.', 'Wheat'),
    ('Cold Coffee', 'Drinks', 5000, 'Chilled milk coffee.', 'Milk'),
    ('Fresh Lime Water', 'Drinks', 2500, 'Fresh lemon water with sugar and a pinch of salt.', ''),
]


@app.post('/owner/menu-suggestions')
def add_menu_suggestions(authorization: str = Header(default='')):
    with db() as conn:
        user = auth(conn, authorization, True)
        added = 0
        for name, category, price, description, allergens in EXTRA_MENU:
            if conn.execute('SELECT 1 FROM menu WHERE canteen_id=? AND lower(trim(name))=lower(?)',
                            (user['canteen_id'], name)).fetchone():
                continue
            mid = secrets.token_hex(12)
            conn.execute('INSERT INTO menu VALUES(?,?,?,?,?,?,?,?,?)',
                         (mid, user['canteen_id'], name, category, price, 0, 1, 1, allergens))
            conn.execute('INSERT INTO menu_media VALUES(?,?,?)', (mid, '', description))
            added += 1
        audit(conn, user['id'], None, f'Added {added} menu suggestions with zero opening stock')
        return {'added': added}


class PasswordChange(BaseModel):
    current_password: str = Field(max_length=128)
    new_password: str = Field(min_length=10, max_length=128)


@app.post('/me/password')
def change_password(body: PasswordChange, authorization: str = Header(default='')):
    with db() as conn:
        user = auth(conn, authorization)
        if not password_ok(body.current_password, user['password']):
            fail(403, 'Current password is incorrect')
        conn.execute('UPDATE users SET password=? WHERE id=?', (password_hash(body.new_password), user['id']))
        conn.execute('DELETE FROM sessions WHERE user_id=? AND digest<>?', (user['id'], digest(authorization[7:])))
        audit(conn, user['id'], None, 'Password changed; other sessions revoked')
    return {'ok': True}


class OwnerSetup(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=10, max_length=128)
    name: str = Field(min_length=1, max_length=100)
    canteen_id: str = Field(default='campus-demo', max_length=100)
    canteen_name: str = Field(default='Campus Canteen', min_length=1, max_length=100)
    organization: str = Field(default='My College', min_length=1, max_length=100)


@app.post('/setup/owner')
def setup_owner(body: OwnerSetup, x_setup_token: str = Header(default='')):
    expected = os.getenv('OWNER_SETUP_TOKEN', '')
    if not expected or not secrets.compare_digest(expected, x_setup_token):
        fail(403, 'Open the private owner setup link from OWNER_ACCOUNT.bat, or enter your hosting OWNER_SETUP_TOKEN.')
    email = body.email.strip().lower()
    if '@' not in email or '.' not in email.split('@')[-1]:
        fail(422, 'Enter a valid email')
    with db() as conn:
        canteen = conn.execute('SELECT id FROM canteens WHERE id=?', (body.canteen_id,)).fetchone()
        if not canteen:
            if conn.execute('SELECT 1 FROM canteens').fetchone():
                fail(404, 'Select an existing canteen')
            conn.execute('INSERT INTO canteens(id,name,organization) VALUES(?,?,?)', (body.canteen_id,body.canteen_name,body.organization))
            conn.execute('INSERT INTO canteen_settings(canteen_id) VALUES(?)', (body.canteen_id,))
            ensure_slots(conn, body.canteen_id)
        user = conn.execute('SELECT * FROM users WHERE email=?', (email,)).fetchone()
        if user:
            if user['role'] != 'owner' or user['deleted'] or user['canteen_id'] != body.canteen_id:
                fail(409, 'This email belongs to another account. Use a different owner email.')
            conn.execute('UPDATE users SET password=? WHERE id=?', (password_hash(body.password),user['id']))
            conn.execute('DELETE FROM sessions WHERE user_id=?', (user['id'],))
        else:
            conn.execute('INSERT INTO users(id,name,email,password,role,canteen_id) VALUES(?,?,?,?,?,?)',
                (secrets.token_hex(16),body.name,email,password_hash(body.password),'owner',body.canteen_id))
    seed_extended_menu()
    return {'ok': True}


def seed_extended_menu():
    # A migration runs once per canteen; never replenish actual inventory implicitly.
    with db() as conn:
        conn.execute('CREATE TABLE IF NOT EXISTS menu_seed_versions(canteen_id TEXT PRIMARY KEY, version INTEGER)')
        for c in conn.execute('SELECT id FROM canteens').fetchall():
            cid = c['id']
            if conn.execute('SELECT 1 FROM menu_seed_versions WHERE canteen_id=?', (cid,)).fetchone():
                continue
            for name, category, price, description, allergens in EXTRA_MENU:
                if conn.execute('SELECT 1 FROM menu WHERE canteen_id=? AND lower(trim(name))=lower(?)',(cid,name)).fetchone():
                    continue
                mid = secrets.token_hex(12)
                conn.execute('INSERT INTO menu VALUES(?,?,?,?,?,?,?,?,?)',(mid,cid,name,category,price,0,1,1,allergens))
                conn.execute('INSERT INTO menu_media VALUES(?,?,?)',(mid,'',description))
            conn.execute('INSERT INTO menu_seed_versions VALUES(?,1)',(cid,))


seed_extended_menu()
