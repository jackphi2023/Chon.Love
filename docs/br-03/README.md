# BR-03 — Auth and Session Beta

BR-03 adds email/password authentication to the existing Google Auth flow, implements password recovery for normal accounts, validates restored sessions, and makes application sign-out revoke all sessions by default.

The 16 controlled Beta fixtures keep the operator-issued credential unchanged. They are excluded from self-service recovery in the client, and no credential is stored in source, migrations, tests, CI output, or documentation.

BR-03 is implemented on `agent/br-03-auth-session-beta` and targets the canonical `release/beta-mobile-web` branch through a Draft pull request. It does not authorize production deployment or financial features.
