# Repair validation — 24 October 2026

## Passed

- Installed Python dependencies in a clean virtual environment using the included lockfile.
- Frontend `npm ci` and `npm run build`: successful TypeScript check and production build.
- Frontend `npm run lint`: zero errors; Non-blocking warnings remain about effects, dependency arrays, development fast refresh, and time-based rendering. No conditional-hook errors remain.
- Backend `python -m pytest -q`: 32 tests passed. Includes cash order lifecycle, idempotency, concurrent inventory/capacity reservations, canteen isolation, edit rollback, cancellation, expiry, authentication, payment signature/refund validation using mocked gateway responses, owner settings/menu operations, local CORS preflight, schedule validation, and packaged website/API routing.
- Started launcher from a different current directory with port 8000 deliberately occupied. It selected port 8001, served the website and /api/health, and stopped cleanly.
- Headless Chromium browser checks against an isolated database: registration, cash checkout/token, edit-order dialog, cancellation request, owner sign-in, record cash, approve cancellation, cash refund reconciliation, preparation, mark ready, collection-code confirmation, add meal, edit dialog reopening, fresh form reset, and 390px viewport without horizontal overflow. No uncaught browser page errors occurred in the successful flow.
- Shipped backend/cantea.db matches the uploaded database byte-for-byte. Test accounts/orders were confined to a separate temporary database.
- Seven original CSS/local visual asset files verified unchanged against the input ZIP. Layout markup and animations were preserved while fixing state and request handling.

## Not claimed

- The Windows batch wrappers have not been executed on the user's Windows computer; the Python launcher was exercised on Linux.
- No real Razorpay charge, settlement, refund, or production webhook delivery was performed. Merchant credentials are required.
- The original Expo mobile project is retained, not rebuilt or Play Store certified.
- A local smoke test is not a production security, load, accessibility, or full cross-browser audit.
- External images/fonts retain their original URLs and depend on network availability.

## Run again

From backend, with the project environment activated: `python -m pytest -q`.
From web: `npm ci`, `npm run build`, and `npm run lint`.
Use START_CANTEA.bat for normal use, OWNER_ACCOUNT.bat for local owner recovery, and REBUILD_WEBSITE.bat after source edits.
