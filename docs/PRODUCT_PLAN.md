# Cantea product plan

The value is less time waiting during short breaks. A token alone cannot deliver that. Scheduled capacity, kitchen visibility, reliable availability and a dedicated pickup counter are the operational ingredients.

Pilot with one canteen and one meal period. Measure median counter waiting time, percentage ready during the pickup window, no-shows, cancellations and inventory mismatches against the canteen's earlier process. Do not promise a percentage time saving before measuring it.

## Decisions
- Counter pickup is the default. Classroom or desk delivery needs dispatch, delivery fees and handoff tracking.
- Slots use order-count capacity, a pilot heuristic. A large order takes more work than a tea; tune limits using actual kitchen throughput.
- Booking requires a published future slot. Owners publish slots within their canteen's opening hours.
- Pay-at-counter retains a cashier interaction. A separate pickup lane and online payment reduce that bottleneck.
- Inventory is sellable finished portions, not ingredient recipes. Existing reservations must not be counted again when updating available stock.
- Meal edits stop at preparation, payment or gateway checkout. Extras then require another order/token.
- Cancellation requested, cancellation approved and refund processed are distinct states.
- Tokens are unique random references, not numerical queue positions.

## Expansion
| Phase | Added scope | Exit condition |
| --- | --- | --- |
| College pilot | One canteen, limited menu, cash and tested online payments | Measured improvement and reliable reconciliation |
| Multiple campuses | Tenant admin, staff roles, access control, scalable persistence | Isolation tests and restore drills |
| IT offices | Employee SSO, subsidies, organization billing | Approved business rules and reconciliation |
| Hospital cafeterias | Staff/visitor meals and agreed pickup flows | Operational approval; no clinical dietary assumptions |

A canteen/institution subscription is a possible business model. Validate willingness to pay and support costs before choosing prices. Keep student adoption simple during the first pilot.
