# BR-05 — Creator Activity, Privacy and Album E2E

BR-05 validates the complete closed-Beta Creator content state machine on top of BR-04.

## Scope

- Creator text, image, and external-video submission.
- Moderator-only approval and rejection.
- Whole-Creator Activity visibility: `public`, `friends`, and `fans`.
- Owner, anonymous, stranger, accepted-friend, active-Fan, revoked-Fan, and blocked-user behavior.
- Activity-derived image album access.
- Original image access metadata and Storage authorization dependencies.
- Public and Fan profile albums.
- Activity reporting, report throttling, archive, delete, block, and unblock behavior.

## Privacy hardening

Migration `20260731153859_br_05_creator_activity_report_privacy_guard.sql` closes a privacy gap in `report_creator_activity`. A reporter must now be able to view the Creator Activity surface before reporting a post, image, or external link. The target must also be published, and image reports require approved attached media.

## Test isolation

The pgTAP suite creates five deterministic ephemeral adult actors: Creator, friend, Fan, stranger, and moderator. Every fixture and mutation runs inside one transaction and ends with `ROLLBACK`.

No controlled Beta credential, service-role key, gift operation, purchase verification, withdrawal, or VietQR settlement is used.

Passing BR-05 does not authorize merge, public deployment, or financial feature enablement.
