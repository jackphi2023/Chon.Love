# BR-04 — Core Social Multi-account E2E

BR-04 validates the closed-Beta Core Social state machine across multiple independent identities.

Scope:

- discovery visibility and self-exclusion
- outgoing, incoming, accepted, declined, and cancelled friendship states
- automatic direct-conversation creation after acceptance
- two-member conversation membership
- idempotent text messaging
- unread counts and read receipts
- non-member authorization denial
- user and message reporting safeguards
- block, unblock, discovery hiding, and chat shutdown behavior
- rollback isolation so tests do not alter Beta data

The branch is `agent/br-04-core-social-multi-account-e2e` and its integration base is `agent/br-03-auth-session-beta`.

BR-04 does not change the 16 controlled Beta credentials, does not enable financial features, and does not authorize merge or production deployment.
