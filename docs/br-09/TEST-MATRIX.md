# BR-09 Test Matrix

| Layer | Contract | Expected |
|---|---|---|
| PostgreSQL | ingestion flag | disabled by default |
| PostgreSQL | metadata privacy | unknown/sensitive keys rejected |
| PostgreSQL | ACL/RLS | no anon/private table access |
| PostgreSQL | idempotency/rate limit | one row per event ID; bounded hourly volume |
| PostgreSQL | immutability/retention | direct mutation denied; guarded purge succeeds |
| TypeScript | retry policy | reads max two; auth/financial/non-idempotent zero |
| TypeScript | telemetry sanitizer | no raw message or sensitive metadata |
| UI | contrast/touch | WCAG AA and ≥44 points |
| Mobile browser | axe/keyboard | no serious/critical login violations |
| Mobile browser | mutation failure | one auth request; no automatic retry |
| Regression | BR-01–BR-08 | unchanged and passing |
