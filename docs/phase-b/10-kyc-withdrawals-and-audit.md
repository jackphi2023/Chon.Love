# Phase B — Session 10: KYC, Bank Accounts, Manual Withdrawals, Deletion and Audit

## Canonical cross-platform backend

Expo Web, Android and iOS use the same Supabase project `asnydvqsduonyidjyyzq`. They share Auth, redacted payout state, withdrawal lifecycle, account-deletion state, generated TypeScript types and `payout_sync` Realtime invalidation.

Sensitive KYC and bank records are not placed in the public schema and are not returned through Realtime.

## Sensitive-data boundary

`private.kyc_profiles`, `private.kyc_documents` and `private.bank_accounts` contain encrypted payloads plus minimum redacted fields such as document last four, bank code and account last four.

Ciphertext format is versioned:

```text
v1.<base64url AES-GCM IV>.<base64url ciphertext-and-tag>
```

Encryption and decryption run only in JWT-protected Edge Functions. Production requires a 32-byte key in:

```text
MYFAN_PII_ENCRYPTION_KEY_B64
```

No placeholder key is committed. Without the secret, PII submission and sensitive admin review fail closed. Key rotation and external KMS integration remain a production dependency; this session establishes the versioned encryption boundary but does not claim managed KMS rotation is complete.

Audit JSON never contains legal name, full document number, full account number, account holder ciphertext, purchase token, session token or secrets.

## KYC documents

The existing `kyc-private` bucket remains private. The user may only INSERT an object after `prepare_kyc_document_upload` registers an immutable owner/media path. There is no client SELECT, UPDATE or DELETE policy for this bucket.

After upload, `finalize_kyc_document_upload` records the document. Admin review uses `payout-admin`, a service-only authorization RPC and a 60-second signed URL. Each sensitive view and signed URL issuance writes an immutable audit event.

## Creator payout readiness

A Creator is payout-eligible only when all are true:

- Creator status is `approved`.
- Account status is active.
- KYC is approved and unexpired.
- At least one bank account is verified.
- No active `creator_reward`, `withdrawal` or `account` hold exists.

Clients read only redacted KYC/bank status and `get_my_payout_summary`.

## Withdrawal transaction

`request_withdrawal`:

1. Validates authenticated active adult and approved Creator.
2. Validates approved KYC and verified owner bank account.
3. Rejects active financial holds.
4. Loads minimum, VND rate and heart units from server config.
5. Locks the Creator earning account and available reward positions.
6. Moves exact FIFO reward-position units from available to held.
7. Snapshots VND conversion and redacted bank destination.
8. Creates the withdrawal and immutable `withdrawal_hold` ledger entry.
9. Writes redacted audit and updates `economy_sync` plus `payout_sync`.

VND snapshot uses integer arithmetic:

```text
amount_vnd = requested_reward_units × heart_vnd_rate_snapshot / heart_units_per_heart_snapshot
```

The user request never moves units directly to paid.

## Manual admin lifecycle

Protected service operations enforce authoritative roles from `private.user_roles`:

- `approve`: pending/under-review to approved; no payout occurs.
- `processing`: approved to processing.
- `reject`: held returns to available and writes `withdrawal_released`.
- `paid`: approved/processing moves held to paid once, records payment reference and writes `withdrawal_paid`.

Every action is idempotent and audited. Client roles cannot insert or update withdrawals, ledgers, balances or audit rows.

## Fraud and compliance holds

`private.account_holds` supports `gift`, `purchase`, `creator_reward`, `withdrawal` and `account` scopes. Financial holds freeze Creator payout eligibility. Creation and release require finance or super-admin authorization and immutable audit.

## Account deletion lifecycle

`request_account_deletion` immediately disables discovery and Nearby, deactivates the profile, disables exact-location participation, marks the account as deletion requested and freezes Creator payout state.

Active withdrawals, open Creator liabilities or unpaid Creator reward obligations create a legal hold. During the grace period, a user may cancel and restore the prior profile/account state. Completion anonymizes public profile fields but preserves required financial ledgers and audit records.

The JWT-protected `account-deletion` Edge Function also revokes refresh sessions globally after a request. An already-issued access JWT remains valid until its configured expiry, so sensitive server operations continue to check account status.

## Shared Mobile Web / Android / iOS contract

`@myfan/supabase` exposes one payout API for all platforms:

- KYC upload preparation/finalization and encrypted submission.
- Redacted KYC and bank state.
- Bank submission.
- Payout summary.
- Withdrawal request/cancel/history.
- Account deletion request/cancel/status.
- `payout_sync` Realtime subscription.

No platform stores a service-role key or encryption key. Native and web clients send the same DTOs and consume the same generated database contract.

## Validation

Session 10 tests cover private data isolation, private Storage behavior, KYC/bank review, payout eligibility, minimum withdrawal, row locking, available-to-held conservation, rejection release, manual paid transition, duplicate payout prevention, role enforcement, immutable audit, deletion lifecycle and financial retention.

A true two-connection PostgreSQL test races two withdrawal requests against one available balance and requires exactly one success.

## Release dependencies

- Configure `MYFAN_PII_ENCRYPTION_KEY_B64` separately in each Supabase environment.
- Establish formal encryption-key rotation/KMS procedure.
- Confirm KYC retention and deletion schedule with Vietnamese legal/privacy counsel.
- Define operational KYC/finance SLAs and dual-control policy for manual payments.
- Integrate real bank transfer evidence and reconciliation before production payouts.
- Add queue/list UI in the later Admin sessions.
