# LX-20 — Verification + Private Photos

## Product override

LX-20 intentionally defers Activity to keep Luxy V1 aligned with the current Seeking reference. Activity feature flags are off, the mobile Activity route redirects to Search, and Activity is removed from the Luxy navigation/profile presentation. Legacy backend tables remain intact for a future session.

## Profile photo visibility

- New non-avatar profile photos are uploaded as `public` from personal profile management.
- The owner can toggle each eligible photo `Public -> Private` with **Ẩn** and `Private -> Public` with **Hiện công khai**.
- Private photos are a server-authoritative paid membership entitlement.
- Premium and Diamond automatically see all eligible private photos on Member Profile, interleaved with the profile photo gallery and labeled **Ảnh riêng tư**.
- Free receives only the private-photo count/locked tile and **Yêu cầu xem · Nâng cấp** CTA; no private storage paths are returned.
- Legacy owner approval requests no longer authorize private-photo reads.
- Gift, Fan and friendship state never unlock private photos.
- Block remains higher priority than membership.

## Verification

- Selfie reuses the live-camera member-photo verification gate and >60% face similarity auto-pass path; mismatches go to Admin review.
- CCCD is a separate profile-verification contract, not payout KYC. Front/back files are stored in a dedicated private bucket and reviewed by Moderator/Super Admin.
- LinkedIn verification stores a validated `linkedin.com/in/...` URL and supports Admin approve/reject.
- Public profile exposes only boolean-style badges: **Ảnh**, **Danh tính**, **LinkedIn**.
- Admin CCCD detail uses 60-second signed URLs; raw identity tables are not granted to authenticated clients.

## Verification gate

Dedicated `LX-20 Contract` covers:

- mobile TypeScript
- Admin TypeScript
- clean repository migration reset
- LX-17 membership regression
- LX-19 gift regression
- LX-20 private-photo + verification pgTAP
- public/private schema lint
