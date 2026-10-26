# Cantea: repaired project

Your React frontend, animations, styling, FastAPI backend, mobile source, and existing SQLite data are retained. This package includes a built website, so running it does not require npm or Node.js.

## Run on Windows

1. Extract the entire ZIP into a NEW folder, such as Desktop\Cantea-Fixed. Do not run from inside the ZIP or merge it with the old project's virtual environments.
2. Double-click START_CANTEA.bat.
3. Allow the first run to install Python packages. Internet is required for this installation. Python 3.10+ must already be installed; 3.12 or 3.13 is recommended. If Python is not found, install it with “Add Python to PATH” enabled.
4. The browser opens your website automatically. Keep the Cantea terminal window open. If the browser does not open, copy the “Cantea website” address printed in that window.
5. Press Ctrl+C in the terminal to stop the server.

The normal address is http://127.0.0.1:8000. If that port is occupied, the launcher chooses 8001, 8002, etc. Use the exact address it prints. You do not need to open 0.0.0.0, use a network IP, or start a second server.

Your previous owner/student accounts remain in backend/cantea.db. Use your existing email/password. Student registration is available in the website. If you forgot the owner password, run OWNER_ACCOUNT.bat, enter the listed owner email, and set a new password of at least 10 characters. Password typing is hidden. This recovery tool is for the person with local access to the project. It also lets you create another owner account explicitly. No public default passwords are embedded in the frontend.

If starting with an empty database, START_CANTEA.bat asks for the initial canteen and owner details. It does not overwrite an existing canteen.

## What's fixed

- The website calls /api on its own address. The packaged server handles both website and API, avoiding hardcoded localhost/network-IP and CORS mismatches.
- Vite development and preview include an /api proxy to the Python API.
- Five stateful dialogs no longer call React hooks conditionally. Forms reset when reopened or switched to a different order/meal.
- Authentication forms initialize when opened, after canteens have loaded.
- Expired pickup-slot selections are replaced with currently available slots.
- Checkout retries retain their idempotency key, and a failed payment launch no longer silently appears to have completed checkout.
- Owner schedule edits are not overwritten by background polling. Invalid times are rejected. Unbooked obsolete future slots are regenerated when settings change; booked slot records remain.
- A temporary canteen closure blocks new orders.
- Database and .env paths resolve relative to backend, regardless of where the command was launched.
- Python package versions are locked, including timezone data for Windows.
- Removed copied machine-specific virtual environments, caches, and the accidental npm lockfile in the Python backend. They are recreated as needed.

## Online payments and data

Cash orders work without payment credentials. Online payments require your Razorpay key ID and secret in backend/.env, and a webhook secret for webhook verification. Restart after changing credentials. The app does not simulate successful payment. Real gateway calls, settlement, and refunds were not tested against a live merchant account.

The SQLite file contains your existing accounts and menu. Back it up with the server stopped before making major changes. Do not distribute this private project ZIP publicly with its database or credentials. Photos and fonts retain their original external URLs and may require internet access.

## Editing the project

Source folders:
- web: your React website.
- backend: Python API, database, and automated tests.
- mobile: original Expo mobile application, retained without changes.

After changing website code, run REBUILD_WEBSITE.bat, then restart START_CANTEA.bat. Rebuilding requires Node.js 22.12+ and npm; simply running the supplied build does not.

For separate development servers, first let START_CANTEA.bat install Python dependencies, then stop it. Open two terminals in the extracted project directory.

Backend:
```bat
cd backend
..\.venv\Scripts\python.exe -m uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

Frontend:
```bat
cd web
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The Vite proxy forwards /api to port 8000. Keep VITE_API_URL unset for local use. For deliberately separate hosted origins, configure VITE_API_URL and the backend CORS_ORIGINS with the exact deployed origins.

Backend tests, from the project directory:
```bat
cd backend
..\.venv\Scripts\python.exe -m pytest -q
```

Frontend checks:
```bat
cd web
npm run build
npm run lint
```

The existing compose.yaml remains an API-only Docker option; the Windows launcher is the recommended way to run this repaired website locally.

## Verification and limits

See docs/REPAIR_VALIDATION.md for the checks performed. The browser and Python tests run on Linux in the repair environment. Windows .bat wrappers are provided but have not been executed on your Windows computer. This repair is a local runnable website package; it is not an Android APK, a Play Store release, or a production hosting deployment. The original mobile application has been retained but was not rebuilt as part of this repair.
