# Session 23 implementation status

Creator Activity supports required text, optional exactly one image, or optional exactly one allowlisted video link. Image and video cannot be combined and multiple images are rejected by UI, RPC and schema.

One Creator-level setting controls the whole approved Activity surface:

- `public`: everyone may view;
- `friends`: accepted friends and active Fans may view;
- `fans`: active Fans only.

The same server predicate protects text, images, video/link data, the Activity-derived album and signed Storage access. The previous per-post image access model is retired from client permissions.

Authenticated profile presentation remains independent from Activity privacy and includes name, age, active status, introduction, interests, province, approximate distance and online/offline state.

The implementation includes forward migrations, shared validation, native and Expo Web screens, public web gating, Admin moderation, private media delivery and automated tests.

GitHub Actions CI #471 passed lint, TypeScript, unit tests, Admin build, public web static export and Expo Web export.

The development database has no user, relationship or transaction fixtures, so physical-device and multi-account validation remains pending. Real transactions remain disabled until the payment integration is enabled.
