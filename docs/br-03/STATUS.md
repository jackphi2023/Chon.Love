# BR-03 Status

- Status: complete; Draft Beta candidate
- Draft pull request: `#16`
- Head branch: `agent/br-03-auth-session-beta`
- Base branch: `release/beta-mobile-web`
- Validated implementation head: `a7c5a757da13786c7586a28d5b7b192147a8c642`
- Application CI: run `#630`, workflow run `30636692059`, success
- Database CI: run `#251`, workflow run `30636693383`, success
- Supabase project: `asnydvqsduonyidjyyzq`
- Remote migration ledger: 75 entries
- Latest migration: `20260731134617_br_03_remove_rotation_scaffolding`
- Controlled Beta users: 16 present, 16 email-confirmed, 16 password-enabled
- Controlled Beta credential: retained operationally; not stored in repository
- Controlled Beta self-service recovery: disabled
- Normal account password recovery: enabled in application flow
- Default application sign-out scope: global
- Temporary database rotation table/RPCs: absent
- Controlled Beta sessions revoked after CI: 16 removed, 0 active
- Merge: not authorized
- Production deployment: not authorized
- Financial features: disabled

The session-revocation operation deleted only Auth session rows and their cascading refresh-token records. It did not update the controlled Beta users or their password records.
