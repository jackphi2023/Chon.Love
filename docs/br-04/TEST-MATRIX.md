# BR-04 Test Matrix

| Scenario | Actor A | Actor B | Actor C | Actor D | Expected invariant |
|---|---|---|---|---|---|
| Discovery | viewer | visible target | unrelated | unrelated | Same-province target is visible; viewer never sees self |
| Friend request | requester | addressee | unrelated | unrelated | A sees sent; B sees received |
| Pre-accept chat | unrelated | target | caller | unrelated | C has no direct conversation with B |
| Accept | requester | accepter | unrelated | unrelated | One accepted friendship creates one direct conversation with exactly two members |
| Message | sender | receiver | unrelated | unrelated | Client message ID is idempotent; B sees one unread message |
| Read receipt | sender | reader | unrelated | unrelated | B marks read; A sees `is_read_by_other` |
| Message report | reporter | participant | unrelated | unrelated | Visible message can be reported; duplicate report is throttled |
| Conversation isolation | participant | participant | attacker/non-member | unrelated | C cannot read or send in A-B conversation |
| Block | blocked actor | blocker | unrelated | unrelated | Friendship becomes cancelled; chat closes; blocker is hidden from A profile/discovery |
| Unblock | former blocked actor | unblocking actor | unrelated | unrelated | Old friendship/chat are not restored automatically |
| Reconnect | requester | decliner | unrelated | unrelated | New request is allowed after unblock and can be declined |
| Cancel | unrelated | unrelated | addressee | requester | D can cancel a pending request to C |
| Isolation | all | all | all | all | Entire fixture lifecycle runs inside one transaction and rolls back |

## Test layers

1. `scripts/validate-br04.mjs` verifies the repository contract and forbids financial operations in this suite.
2. `supabase/tests/br_04_core_social_multi_account_e2e.sql` runs the 34-assertion pgTAP state machine on a clean local database.
3. A remote Supabase transaction using the same four-actor lifecycle is executed with `ROLLBACK` to verify hosted behavior without changing Beta data.
4. Existing application lint, TypeScript, unit tests, Admin build, Public Web build, and Expo Web export remain mandatory.

## Explicit exclusions

BR-04 does not test or enable:

- Google Play Billing
- VietQR payment settlement
- gift sending
- creator reward settlement
- KYC payout eligibility
- creator withdrawals
