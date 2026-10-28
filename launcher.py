"""Portable local launcher. No Node installation is needed for the included website build."""
import hashlib
import secrets
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / 'backend'
ENV = ROOT / '.venv'
PYTHON = ENV / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
LOCK = BACKEND / 'requirements-lock.txt'


def run(command, **kwargs):
    subprocess.run(command, check=True, **kwargs)


def bootstrap():
    if sys.version_info < (3, 10):
        raise RuntimeError('Python 3.10 or newer is required. Python 3.12 or 3.13 is recommended.')
    if not PYTHON.is_file():
        print('Creating the Cantea Python environment...', flush=True)
        run([sys.executable, '-m', 'venv', str(ENV)])
    stamp = ENV / '.cantea-dependencies'
    signature = hashlib.sha256(LOCK.read_bytes()).hexdigest()
    if not stamp.is_file() or stamp.read_text() != signature:
        print('Installing dependencies. Internet is needed on the first run...', flush=True)
        run([str(PYTHON), '-m', 'pip', 'install', '-r', str(LOCK)])
        stamp.write_text(signature)
    if '--ready' not in sys.argv:
        result = subprocess.call([str(PYTHON), str(Path(__file__).resolve()), *sys.argv[1:], '--ready'])
        raise SystemExit(result)
    sys.path.insert(0, str(BACKEND))


def accounts(reset=False):
    import getpass
    from app import db, init_db
    with db() as conn:
        canteens = conn.execute('SELECT id,name FROM canteens').fetchall()
        owners = conn.execute("SELECT email FROM users WHERE role='owner' AND deleted=0").fetchall()
    if not canteens:
        print('\nFirst-time canteen setup (your password is hidden while typing).')
        email = input('Owner email: ').strip().lower()
        if '@' not in email or '.' not in email.split('@')[-1]:
            raise RuntimeError('Enter a valid owner email, then run the launcher again.')
        name = input('Canteen name [Campus Canteen]: ').strip() or 'Campus Canteen'
        org = input('College/company name [My College]: ').strip() or 'My College'
        run([sys.executable, str(BACKEND / 'manage.py'), 'setup', '--email', email,
             '--name', name, '--organization', org], cwd=BACKEND)
        init_db()
    elif reset:
        print('\nExisting owner accounts:')
        for owner in owners:
            print('  ' + owner['email'])
        email = input('Owner email to reset, or a NEW email to create an owner: ').strip().lower()
        if '@' not in email or '.' not in email.split('@')[-1]:
            raise RuntimeError('Enter a valid email address.')
        if email in [x['email'] for x in owners]:
            run([sys.executable, str(BACKEND / 'manage.py'), 'set-password', '--email', email], cwd=BACKEND)
        else:
            for canteen in canteens:
                print(f"  {canteen['id']}: {canteen['name']}")
            cid = input(f"Canteen ID [{canteens[0]['id']}]: ").strip() or canteens[0]['id']
            run([sys.executable, str(BACKEND / 'manage.py'), 'create-owner', '--email', email,
                 '--canteen', cid, '--name', 'Canteen owner'], cwd=BACKEND)
    else:
        print('Existing canteen and accounts retained. Use your current login.')
        print('Forgot the owner password? Close this window and run OWNER_ACCOUNT.bat.')


def rebuild():
    npm = shutil.which('npm.cmd' if os.name == 'nt' else 'npm')
    if not npm:
        raise RuntimeError('Install Node.js 22.12+ to rebuild the website. It is NOT required to run the included build.')
    # npm.cmd is a trusted installed executable; project path stays in cwd, not shell text.
    run([npm, 'ci'], cwd=ROOT / 'web')
    run([npm, 'run', 'build'], cwd=ROOT / 'web')


def serve():
    dist = ROOT / 'web' / 'dist' / 'index.html'
    if not dist.is_file():
        rebuild()
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    for port in range(8000, 8021):
        try:
            sock.bind(('127.0.0.1', port))
            break
        except OSError:
            continue
    else:
        sock.close()
        raise RuntimeError('Ports 8000-8020 are busy. Close old server windows and try again.')
    url = f'http://127.0.0.1:{port}'
    os.environ['PUBLIC_BASE_URL'] = url + '/api'
    try:
        setup_token = secrets.token_urlsafe(32)
        os.environ["OWNER_SETUP_TOKEN"] = setup_token
        from app import db
        with db() as conn:
            needs_setup = not conn.execute("SELECT 1 FROM users WHERE role='owner' AND deleted=0").fetchone()
        open_url = url + ("/#setup=" + setup_token if needs_setup or "owner" in sys.argv else "")
        from server import app
        import uvicorn
        print(f'\nCantea website: {url}\nKeep this window open. Press Ctrl+C to stop.\n', flush=True)
        def open_when_ready():
            for _ in range(100):
                try:
                    with urllib.request.urlopen(url + '/api/health', timeout=1) as response:
                        if response.status == 200:
                            if '--no-browser' not in sys.argv:
                                webbrowser.open(open_url)
                            return
                except OSError:
                    time.sleep(0.2)
        threading.Thread(target=open_when_ready, daemon=True).start()
        config = uvicorn.Config(app, host='127.0.0.1', port=port, log_level='info')
        uvicorn.Server(config).run(sockets=[sock])
    finally:
        sock.close()


if __name__ == '__main__':
    try:
        os.chdir(ROOT)
        bootstrap()
        if 'owner' in sys.argv:
            serve()
        elif 'rebuild' in sys.argv:
            rebuild()
        else:
            serve()
    except KeyboardInterrupt:
        print('\nCantea stopped.')
    except (Exception, subprocess.CalledProcessError) as exc:
        print(f'\nCantea could not start: {exc}', file=sys.stderr)
        print('Keep this error visible. Check your Python installation and first-run internet connection.', file=sys.stderr)
        raise SystemExit(1)
