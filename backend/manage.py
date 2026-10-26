"""Explicit provisioning only. No demo users are created by the server."""
import argparse
import getpass
import secrets
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from app import db, password_hash, ensure_slots

p=argparse.ArgumentParser()
p.add_argument('command',choices=['setup','slots','set-password','create-owner','list-users'])
p.add_argument('--canteen',default='campus-demo')
p.add_argument('--name',default='Campus Canteen')
p.add_argument('--organization',default='My College')
p.add_argument('--kind',choices=['college','company','hospital'],default='college')
p.add_argument('--email',default='owner@example.com')
p.add_argument('--days',type=int,default=7)
a=p.parse_args()

if a.command=='setup':
    password=getpass.getpass('Set owner password (10+ characters): ')
    if len(password)<10:
        raise SystemExit('Password too short')
    with db() as c:
        if c.execute('SELECT 1 FROM canteens WHERE id=?',(a.canteen,)).fetchone():
            raise SystemExit('Canteen already exists; setup does not overwrite data.')
        c.execute('INSERT INTO canteens(id,name,organization,kind) VALUES(?,?,?,?)',(a.canteen,a.name,a.organization,a.kind))
        c.execute('INSERT INTO canteen_settings(canteen_id) VALUES(?)', (a.canteen,))
        c.execute('INSERT INTO users(id,name,email,password,role,canteen_id) VALUES(?,?,?,?,?,?)',
                  (secrets.token_hex(16),'Canteen owner',a.email.lower(),password_hash(password),'owner',a.canteen))
        for name,category,price,stock,allergens in [('Poha','Breakfast',3000,50,'Peanuts'),('Idli Sambar','Breakfast',4000,40,''),('Veg Thali','Lunch',8000,60,'Wheat, milk'),('Masala Chai','Drinks',1500,100,'Milk'),('Veg Sandwich','Snacks',4500,30,'Wheat, milk')]:
            c.execute('INSERT INTO menu VALUES(?,?,?,?,?,?,?,?,?)',(secrets.token_hex(12),a.canteen,name,category,price,stock,1,1,allergens))
        ensure_slots(c, a.canteen, days=a.days)
    print('Canteen created with initial menu and 7-day pickup slots.')

elif a.command=='slots':
    if not 1<=a.days<=30:
        raise SystemExit('Use 1–30 days')
    with db() as c:
        if not c.execute('SELECT 1 FROM canteens WHERE id=?',(a.canteen,)).fetchone():
            raise SystemExit('Create this canteen first')
        created = ensure_slots(c, a.canteen, days=a.days)
        total = c.execute('SELECT count(*) FROM slots WHERE canteen_id=? AND starts>?',
                          (a.canteen, datetime.now(timezone.utc).isoformat())).fetchone()[0]
    print(f'Future slots synced. {created} new slots added. Total future slots available: {total}.')

elif a.command=='set-password':
    email = a.email.strip().lower()
    with db() as c:
        user = c.execute('SELECT id, name, role FROM users WHERE email=?', (email,)).fetchone()
        if not user:
            raise SystemExit(f'User with email {email} not found.')
    password = getpass.getpass(f'Set new password for {email} ({user["name"]} - {user["role"]}) (10+ characters): ')
    if len(password) < 10:
        raise SystemExit('Password must be at least 10 characters')
    with db() as c:
        c.execute('UPDATE users SET password=? WHERE email=?', (password_hash(password), email))
        c.execute('DELETE FROM sessions WHERE user_id=?', (user['id'],))
        c.execute('DELETE FROM login_attempts')
    print(f'Password successfully updated for {email}.')

elif a.command=='create-owner':
    email = a.email.strip().lower()
    with db() as c:
        if not c.execute('SELECT 1 FROM canteens WHERE id=?', (a.canteen,)).fetchone():
            raise SystemExit(f'Canteen {a.canteen} does not exist.')
        if c.execute('SELECT 1 FROM users WHERE email=?', (email,)).fetchone():
            raise SystemExit(f'User {email} already exists.')
    password = getpass.getpass(f'Set owner password for {email} (10+ characters): ')
    if len(password) < 10:
        raise SystemExit('Password must be at least 10 characters')
    with db() as c:
        uid = secrets.token_hex(16)
        c.execute('INSERT INTO users(id,name,email,password,role,canteen_id) VALUES(?,?,?,?,?,?)',
                  (uid, a.name, email, password_hash(password), 'owner', a.canteen))
    print(f'Owner {email} created successfully for canteen {a.canteen}.')

elif a.command=='list-users':
    with db() as c:
        users = c.execute('SELECT id, name, email, role, canteen_id, deleted FROM users').fetchall()
        print(f'Total users: {len(users)}')
        for u in users:
            del_str = ' [DELETED]' if u['deleted'] else ''
            print(f"- {u['name']} <{u['email']}> | Role: {u['role']} | Canteen: {u['canteen_id']}{del_str}")

