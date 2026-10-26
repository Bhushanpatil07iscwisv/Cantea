# Paste this into Antigravity with the Cantea folder open

Act as the senior full-stack engineer responsible for finishing Cantea, an Indian college canteen pre-order and token app. Inspect this existing repository before editing. Read README.md, docs/VALIDATION.md and docs/RELEASE_CHECKLIST.md. Implement and test working code; do not stop at a plan or claim production readiness without evidence.

## Product
Students browse breakfast, lunch, snacks and drinks; select quantities and an available pickup window during canteen hours; reserve food; receive a token immediately; pay online or at the counter; and track preparation. Owners manage menu, prices, available portions, pickup capacity, payment confirmation, cancellation requests and collection. First release: counter pickup, not delivery. Future organizations: colleges, IT offices and hospital cafeterias with isolated tenant data.

## Existing implementation
The project has Expo React Native/TypeScript screens, a FastAPI API, SQLite transactional reservations, tenant authorization, kitchen workflow, Razorpay browser checkout with signed payment verification/webhooks, account deletion and backend tests. Keep the forest green/cream/apricot design and existing working flows. Refactor App.tsx into screens, hooks, typed API and reusable components before expansion. Do not replace working endpoints with mock buttons.

## Start here
Run backend tests, TypeScript checks and Expo dependency checks. Launch the API and mobile/web preview. Verify real student ordering and owner operations. Mark every feature below as implemented, partial or missing based on the code, not assumptions.

## Required invariants
1. The server calculates prices in integer paise and snapshots item names/prices. Client totals are never authoritative.
2. Reserve stock and slot capacity atomically. Test last-item/last-slot races, duplicate taps and retries.
3. Enforce role and tenant authorization on every object. Public registration can never choose owner/admin privileges.
4. Separate order status from payment status. Enforce allowed transitions in the API.
5. Only authorized staff confirm cash after receiving it. Verify online signature, provider order, captured state, exact amount and INR currency. Make webhook processing idempotent.
6. Do not edit a paid or active-checkout amount. For extras, implement linked supplemental orders with separate payments unless a tested adjustment workflow exists.
7. Cancellation approval releases stock exactly once. Before preparation, students request and owners approve/reject. Paid cancellation requires a traceable refund. Late capture on a cancelled order creates refund_due, never another meal.
8. Collection requires confirmed payment and a collection code. Cancelled tokens cannot be collected.
9. Account deletion removes personal profile data and sessions while applying a documented transaction-retention policy.
10. Every UI action must work, with loading, disabled, empty, error, offline and retry states. Support small screens, large fonts and accessibility labels.

## Finish in this order
A. Upgrade Expo and backend dependencies to supported releases meeting current Android requirements. Keep lockfiles, run dependency advisory checks and verify compatibility. Do not assume the pinned baseline is the newest SDK.
B. Add verified email, password recovery, campus invitation/approval and owner MFA; centralized rate limits, request size limits and audit logs.
C. Migrate to PostgreSQL with versioned migrations, row locking and atomic inventory/capacity operations. Add a durable outbox/worker for reservations, payment attempts, retries, webhook events and reconciliation. Avoid gateway calls inside database transactions. Test migration and backup restoration.
D. Add optimistic concurrency/version numbers for inventory changes, stock movement ledger, restocking/waste, menu service windows and configurable canteen hours/holidays. Distinguish finished portions from ingredients. Replace raw date strings with date/time pickers.
E. Add push notifications for order progress and refunds, requesting permission only when useful. Keep in-app status usable if permission is denied. Do not add location/camera permissions without a shipped feature.
F. Add paginated kitchen queues, pickup-time/status filters, low-stock alerts, daily sales and refund reports. Add receipts and tax rules only after the actual business rules are provided.
G. Add linked extra-meal orders and automated full refunds with idempotency, retry/reconciliation and staff exception handling.
H. Add cashier/kitchen/manager roles, platform admin provisioning and organization switching. Later extend to employee SSO/subsidies and multiple canteens. Hospital scope means cafeteria orders, not clinical dietary decisions. Independent merchants need separate payment/settlement configuration.
I. Harden deployment with HTTPS, secrets management, monitoring, persistent database storage, backups and staging.
J. Complete Android signing/builds, real-device tests, support/privacy/deletion URLs, retention jobs, current Play Data safety disclosures, store assets and release checklist. Build and test first; do not publish or spend money without explicit instruction.

## Acceptance tests
Cover student sign-up, browsing, cart edits, pickup slots, instant tokens, cash and test-mode online payments, preparation/ready/collection, cancellations and refunds. Test concurrency, request replay, app termination after payment, checkout timeout, delayed/duplicate/out-of-order webhooks, wrong amount/signature, refund retry, cross-tenant IDs, expired reservations, cancelled-token collection, competing cash/online attempts and account deletion with pending orders/refunds.

## Return
Deliver actual modified source, migrations, locked dependencies, passing checks, Windows PowerShell run commands, API documentation and an honest implemented-versus-remaining checklist. Build a signed APK/AAB only when required credentials are available; otherwise state the external setup required. A JavaScript export is not an APK. Never call this Play Store ready until the release gates, real-device tests and provider tests are complete. Ask only for external decisions or credentials that truly block work; keep secrets out of source and logs.
