# Validation record

Date: 23 October 2026.

## Passed
- 21 pytest cases against temporary SQLite databases using the real FastAPI application.
- Cases cover order lifecycle, exact price calculation, duplicate checkout, last-portion and last-slot concurrency, tenant boundaries, role restrictions, edit rollback, cancellation exactly once, preparation lock, expiry, unavailable payment configuration, checkout locks, payment signatures/amount checks, webhook replay/late capture, refund verification, session revocation, deletion guards, login throttling and quantity/timezone validation.
- TypeScript compilation with strict checking.
- Expo dependency version compatibility check.
- Android Hermes JavaScript export and web production JavaScript export.

## Limits
- Gateway calls in tests are mocked. No Razorpay sandbox or live transaction was performed.
- No native Android compilation, signed APK/AAB, emulator run, physical-device test or Play Console submission was performed.
- Automated browser interaction was attempted but blocked because the Chromium download was invalid/truncated. UI/visual validation is outstanding; bundle success is not a substitute for interaction testing.
- Docker deployment, concurrent production load, backup restoration and notification delivery were not tested.
- This is not a security certification. See dependency findings below and RELEASE_CHECKLIST.md.

## Dependency audit
See DEPENDENCY_AUDIT.json for the final npm audit result. Patched image-size and postcss are pinned through npm overrides. At the time of packaging, remaining high-severity transitive advisories in braces and node-forge had no patched versions available from the checked npm latest tags. They occur in the Expo/React Native build-tool dependency tree and are release blockers requiring reassessment and a supported toolchain upgrade or reviewed mitigation. Do not process untrusted build inputs or treat a passing bundle export as resolution of these advisories.
