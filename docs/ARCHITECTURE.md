# Architecture

The Expo app talks to one REST API. The same app switches to owner screens based on the server-issued user role. The API scopes objects using the authenticated user's canteen ID, never a client-provided role. Canteens can represent colleges, companies or hospital cafeterias; the current mobile account is bound to one canteen.

SQLite WAL provides local persistence. Mutations use BEGIN IMMEDIATE, serializing writes so stock and slot reservations are checked and committed together. This is appropriate for a small single-server pilot, not high-throughput horizontal deployment. A future PostgreSQL migration should preserve these guarantees with transactional row locks and unique constraints.

Session tokens are opaque random values. Only their SHA-256 digests are stored server-side. Passwords use scrypt with random salts. Native tokens are stored in Expo SecureStore. Roles are provisioned from an operator-only CLI; the public registration endpoint always creates students.

## Entities
| Entity | Purpose |
| --- | --- |
| canteens | Organization identity and tenant boundary |
| users / sessions | Login identity, role and revocable sessions |
| menu | Current prices, sellable portions, category and allergens |
| slots | Published pickup windows with order-count capacity |
| orders | Token, collection code, state, payment mapping and idempotency |
| order_items | Immutable price/name snapshots except explicit unpaid cart replacement |
| audit | Order/payment/owner action history |
| login_attempts | Persistent local authentication throttling |

## API map
| Route | Access | Purpose |
| --- | --- | --- |
| GET /canteens | Public | Select campus at registration |
| POST /auth/register, /auth/login | Public | Authenticate |
| POST /auth/logout | Signed in | Revoke session |
| GET, DELETE /me | Signed in | Profile / guarded deletion |
| GET /menu, /slots, /orders | Tenant member | Menu, availability and visible orders |
| POST /orders | Tenant member | Atomic reservation with Idempotency-Key |
| PUT /orders/{id}/items | Order's customer | Replace unlocked unpaid cart |
| POST /orders/{id}/cancel-request | Order's customer | Request cancellation |
| POST /orders/{id}/checkout | Order's customer | Server-created gateway checkout |
| POST /owner/menu; PUT /owner/menu/{id} | Owner | Publish/update menu |
| POST /owner/slots | Owner | Publish future pickup window |
| POST /owner/orders/{id}/status | Owner | Prepare, ready, collect |
| POST /owner/orders/{id}/cash | Owner | Record actual cash receipt |
| POST /owner/orders/{id}/cancel-decision | Owner | Approve/reject cancellation |
| POST /owner/orders/{id}/refund-confirm | Owner | Verify/record completed refund |
| GET /owner/summary | Owner | All-time order/payment aggregates |
| POST /payments/verify, /payments/webhook | Signature-protected | Verify provider payment |
| GET /privacy, /delete-account | Public | Deployment policy pages |

Interactive request schemas are generated at /docs. The payment page uses a random, expiring checkout capability rather than placing the user's auth token in a URL. Configure request-log redaction for this capability URL in deployment.

## Known scaling work
Add migrations, a durable event/outbox worker, payment-attempt records, inventory movement/version history, tenant-specific merchant accounts, a reconciliation job and pagination before broad rollout. Currently order lists return the latest 200 rows. Gateway requests hold the database write lock; provider calls must move outside transactions with durable recovery before scaling. Login limits are local to one database; registration and all public endpoints need centralized abuse limits before public launch.
