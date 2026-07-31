# BR-04 Acceptance Criteria

BR-04 is complete only when all criteria below are true:

- [x] A dedicated branch exists from the validated BR-03 head.
- [x] The suite uses four deterministic isolated actors.
- [x] Discovery includes eligible peers and excludes the current actor.
- [x] Sent and received friend-request views are verified.
- [x] Accepted, declined, and cancelled friendship states are verified.
- [x] Acceptance creates exactly one direct conversation with exactly two members.
- [x] A client message ID is idempotent.
- [x] Unread count and read-receipt behavior are verified.
- [x] Non-members cannot read or send conversation messages.
- [x] Message reporting and duplicate-report throttling are verified.
- [x] Blocking cancels friendship, closes chat, and hides discovery/profile access.
- [x] Unblocking does not restore the old friendship or conversation access.
- [x] A new friendship request is possible after unblock.
- [x] The full fixture lifecycle is transactionally rolled back.
- [x] The suite contains no controlled Beta credential and no service-role key.
- [x] Financial operations are explicitly excluded.
- [ ] BR-04 source validation passes on the final head.
- [ ] Application CI passes on the final head.
- [ ] Database CI passes on the final head.
- [ ] Hosted Supabase rollback E2E is recorded in `STATUS.md`.
- [ ] Final SHA and workflow run identifiers are recorded in `STATUS.md`.

Passing BR-04 does not authorize merge, production deployment, public tester access, or financial feature enablement.
