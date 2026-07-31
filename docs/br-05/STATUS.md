# BR-05 Status

- Status: complete; Draft Beta candidate
- Draft pull request: `#18`
- Head branch: `agent/br-05-creator-activity-privacy-album-e2e`
- Base branch: `agent/br-04-core-social-multi-account-e2e`
- Base SHA: `2f82a9ddb53ccdfa083da02b25c78416651c735a`
- Validated implementation head: `656892ed9ef024c077ae5d36e6e2ecf98b92ac99`
- Application CI: run `#668`, workflow run `30645491883`, success
- Database CI: run `#275`, workflow run `30645491957`, success
- Supabase project: `asnydvqsduonyidjyyzq`
- Report privacy migration: `20260731153859_br_05_creator_activity_report_privacy_guard`
- Anonymous public feed migration: `20260731160038_br_05_anonymous_public_activity_feed_fix`
- Remote migration ledger: 77 entries
- Hosted rollback E2E: passed with isolated Creator, friend, Fan, stranger, and moderator actors
- Persistent hosted BR-05 users: 0
- Persistent hosted BR-05 profiles: 0
- Persistent hosted BR-05 Creator posts: 0
- Persistent hosted BR-05 media: 0
- Persistent hosted BR-05 albums: 0
- Persistent hosted BR-05 reports: 0
- Controlled Beta users present after verification: 16
- Controlled Beta users modified: none
- Controlled Beta credentials modified: none
- Core Creator Activity pgTAP assertions: 78 passed
- Financial operations included: none
- Generated public database types changed: no
- Merge: not authorized
- Production deployment: not authorized
- Financial features: disabled

## Findings closed by BR-05

1. `report_creator_activity` previously did not prove that the reporter could view a `friends` or `fans` Activity surface. The function now requires the same Creator-level privacy gate used by feed and album access.
2. `list_creator_activity` previously left `v_owner` as SQL `NULL` for an anonymous viewer. Although public access authorization returned true, the non-owner row predicate evaluated to null and returned no posts. The function now normalizes anonymous viewers with `coalesce(v_viewer = v_creator, false)` while retaining `private.can_view_creator_activity`.

The first Database CI attempt correctly exposed the anonymous-feed defect at assertion 15. No assertion was removed or weakened. The product function was fixed, the migration ledger was reconciled, and all 78 assertions then passed after a clean reset from all 77 migrations.
