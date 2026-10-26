# Release gate: incomplete

This is pilot source, not a published or certified app. Passing checks does not guarantee Google Play approval.

## Engineering
- [ ] Upgrade/revalidate the pinned Expo baseline and dependencies; resolve relevant security advisories.
- [ ] Build/install a signed Android APK on physical devices; test small screens, large text, process death, app restart and poor connectivity.
- [ ] Deploy an HTTPS API and set the production EXPO_PUBLIC_API_URL; never ship localhost or enable cleartext production traffic.
- [ ] Replace com.yourcompany.cantea with the permanent application ID and configure signing.
- [ ] Build a release AAB and verify target API, native compatibility and signing in current Play Console checks.
- [ ] Add email verification, recovery, campus access controls and owner MFA.
- [ ] Add durable expiry/payment reconciliation, limits, monitoring and pagination.
- [ ] Load-test the chosen deployment; migrate from SQLite before horizontal scaling.
- [ ] Back up and successfully restore the database.

## Payments and operations
- [ ] Complete Razorpay onboarding and configure test/live credentials separately.
- [ ] Test actual provider sandbox success, failure, cancellation, capture delay, retries, duplicate webhooks, late capture and refunds.
- [ ] Reconcile gateway totals against Cantea, including network timeout cases.
- [ ] Set real opening hours, prices, allergens, capacity, cancellation policy and cashier responsibilities.
- [ ] Establish refund support and no-show handling.
- [ ] Add separate merchant settlement configuration before serving independent canteen businesses. Current gateway credentials belong to one merchant.

## Store and privacy
- [ ] Verify brand availability; provide the operator's identity and working support email.
- [ ] Finalize/publicly host the privacy notice. The included notice is explicitly a draft.
- [ ] Test in-app deletion and the external deletion-request route/mailbox.
- [ ] Define and implement retention/deletion jobs. The pilot retains anonymized transactions until a policy is implemented.
- [ ] Complete Play Data safety, content rating, target audience, app-access instructions and SDK disclosures based on actual behavior.
- [ ] Supply screenshots, feature graphic, listing copy and reviewer test accounts.
- [ ] Complete the testing track applying to your account and address pre-launch reports.

Google's current help page requires at least 12 testers opted in continuously for 14 days for affected new personal accounts before applying for production access. Check the requirements shown in your own Console. Do not assume an old target API number remains valid.

Official references:
- https://support.google.com/googleplay/android-developer/answer/14151465
- https://support.google.com/googleplay/android-developer/answer/13327111
- https://support.google.com/googleplay/android-developer/answer/11926878
- https://docs.expo.dev/build/introduction/
- https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/
- https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/
