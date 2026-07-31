# BR-05 Acceptance Criteria

BR-05 is complete only when all criteria below are true:

- [x] A dedicated BR-05 branch exists from the validated BR-04 head.
- [x] Remote and repository migration ledgers contain the same BR-05 migrations.
- [x] Activity reporting requires actual Creator Activity visibility.
- [x] Activity reporting requires a published target.
- [x] Image reporting requires approved attached media.
- [x] Anonymous viewers can read approved posts when Creator Activity is public.
- [x] Anonymous viewers remain non-owners and still pass through the Creator privacy gate.
- [x] The E2E suite uses isolated Creator, friend, Fan, stranger, and moderator actors.
- [x] Text, image, and external-video submission are verified.
- [x] Pending content is visible only to the owner and moderator queue.
- [x] Moderator-only approval and rejection are verified.
- [x] Public, friends, and fans visibility transitions are verified.
- [x] Anonymous, stranger, friend, Fan, owner, revoked-Fan, and blocked-user states are verified.
- [x] Public highlights follow Creator Activity visibility.
- [x] Original Activity image access follows the same privacy gate.
- [x] The Activity-derived album follows the same privacy gate.
- [x] Public and Fan profile albums are verified.
- [x] Fan membership revocation closes Fan-only Activity and album access.
- [x] Blocking closes Activity, original media, reporting, and Fan album access.
- [x] Archive, reject, and delete visibility behavior is verified.
- [x] Duplicate Activity report throttling is verified.
- [x] The full fixture lifecycle ends with `ROLLBACK`.
- [x] The suite contains no controlled Beta credential or service-role key.
- [x] Financial operations are excluded.
- [x] BR-05 source validation passes on the implementation head.
- [x] Hosted Supabase rollback E2E passes with no persistent fixture rows.
- [x] Application CI passes on the implementation head.
- [x] Database CI passes after a clean reset from all 77 repository migrations.
- [x] Validated SHA and workflow run identifiers are recorded in `STATUS.md`.

Passing BR-05 does not authorize merge, production deployment, public tester access, or financial feature enablement.
