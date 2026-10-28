# Persistent data on Render with Neon PostgreSQL

Cantea can keep its frontend and Python backend on Render while storing accounts,
orders, sessions, menu, stock and stock history in a separate PostgreSQL database.
A Render restart no longer clears those records when DATABASE_URL is configured.
SQLite remains available for local development when DATABASE_URL is absent.

## Connect your database

1. Create a Neon account at https://console.neon.tech and create a project named
   Cantea. Choose the Free plan if this is a demo, and a region near your Render
   service. Free plans have usage limits; review them in Neon's dashboard.
2. Click Connect in Neon. Select the database and role, and copy the PostgreSQL
   connection URL. Keep the SSL settings, including sslmode=require. Copy the
   URL only, without `psql`, surrounding quotes, or shell commands.
3. In Render > Cantea > Environment, add DATABASE_URL. Paste the actual Neon URL
   into its value. Never paste it into GitHub, web frontend variables, or chat.
4. Leave PUBLIC_BASE_URL=https://cantea.onrender.com/api. DATABASE_URL takes
   precedence over DB_PATH. Keep OWNER_SETUP_TOKEN for the initial owner setup.
5. Save and deploy after the PostgreSQL code is on main. Existing build and
   start commands do not change. Schema tables and stock triggers are created
   automatically when the server starts. Connection failures stop startup;
   the app never silently falls back to an empty local database.
6. Open https://cantea.onrender.com/api/health. It must show
   {"status":"ok","database":"postgresql"}. If it says sqlite, DATABASE_URL
   is missing or the updated release is not running.
7. Open https://cantea.onrender.com/#setup. Enter your private OWNER_SETUP_TOKEN,
   create the canteen and owner account, sign in, and enter prepared stock.
8. Create a student account and a cash test order. Restart/redeploy the Render
   service. Check that the same login, stock and order still exist.
9. Remove OWNER_SETUP_TOKEN from Render after completing setup, then redeploy.
   The database remains in Neon. Add a new private token only when recovery is
   needed. Do not delete the Neon project, database or branch holding your data.

## Existing data

Switching DATABASE_URL to a new database starts with an empty database. It does
not copy the local SQLite file. Data already erased by Render cannot be recovered
from this update. If you still have a SQLite backup with real orders, keep it and
arrange a migration before accepting new orders in the new database.

## Testing and limitations

The API suite runs on SQLite. Set TEST_POSTGRES_URL to a disposable PostgreSQL
16 database to run every test against both engines. Tests create and delete
isolated schemas; do not point this variable at a production database.

    PYTHONPATH=backend python -m pytest backend/tests -q

The GitHub workflow provisions PostgreSQL 16 and runs both variants. It uses a
throwaway test password, not any production credentials.

The PostgreSQL adapter uses a transaction-level advisory lock for all application
transactions to preserve the original SQLite read-check-write behavior. This
prevents double reservations and overselling through Cantea, but serializes work.
This is appropriate for a small canteen pilot; higher throughput needs narrower
row locks and connection pooling. Direct database edits outside the application
must not race with its order processing. Database timeouts fail the request
rather than returning a successful but partial order.

Render free web services can still sleep, causing slow first loads. A separate
persistent database prevents the local-file data-loss problem; it does not remove
hosting/database usage limits or replace backups. Real Razorpay keys and payment
testing are still needed before accepting money.
