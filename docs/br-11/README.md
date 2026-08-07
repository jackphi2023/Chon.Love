# BR-11 — Native Parity and Development Build

BR-11 closes the Mobile Web → native platform gaps without changing MyFan business rules, database contracts, gift/ledger logic, or financial feature flags.

## Scope implemented in source

- Native Supabase session persistence through a platform storage adapter.
- Android/iOS secure token storage through Expo SecureStore with chunked payloads.
- App lifecycle bridge for TanStack Query focus and Supabase token auto-refresh.
- Camera and media-library permission adapter reused by profile and Creator Activity media.
- Existing browser geolocation / Expo Location split retained.
- Stable custom deep-link scheme: `myfan://`.
- EAS development-build profile for installable Android APKs.
- Android QA matrix for Expo SDK 57 supported OS range.
- CI guard that rejects WebView substitution for native UI.

## Deliberately unchanged

- `packages/domain` business rules.
- `packages/validation` schemas.
- `packages/supabase` RPC/database contract.
- Supabase migrations.
- Gift, Google Play Billing, KYC, Creator withdrawal and financial execution flags.
- Production Android package ID; BR-11 keeps `com.myfan.mobile.dev` for development builds. BR-12 owns the production Play package decision.

## External gates before BR-11 can be marked fully device-PASS

1. Link `apps/mobile` to the correct Expo/EAS project; no EAS project ID is committed or invented in BR-11.
2. Configure EAS build environment values for the existing Supabase public URL and publishable/anon key; never use a service-role key.
3. Add `myfan://auth/callback` to the Supabase Auth redirect allowlist before testing native OAuth/reset flows.
4. Build the `development` Android profile and install the APK on the required device matrix.
5. Execute the acceptance checklist in `ACCEPTANCE.md` and record results in `STATUS.md`.

See `EAS-RUNBOOK.md` and `ANDROID-DEVICE-MATRIX.md` for the operational steps.
