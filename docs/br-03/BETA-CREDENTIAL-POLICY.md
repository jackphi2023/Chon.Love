# Controlled Beta Credential Policy

## Scope

This policy applies only to the 16 pre-created, email-confirmed Beta fixture accounts. It does not apply to Google users, future email/password users, administrators, or any other account-creation path.

## Rules

1. The operator-issued Beta credential remains unchanged for the current closed testing cohort.
2. The credential must never be committed, logged, displayed in screenshots, inserted into migrations, or returned by an Edge Function.
3. The client recognizes only the controlled fixture email range for the purpose of disabling self-service recovery; it does not embed the credential.
4. Normal accounts retain password recovery and reset behavior.
5. Existing Beta refresh sessions may be revoked without changing the credential.
6. Any future credential change requires a separately approved operational runbook, unique secret handling, and session revocation.

## Source-of-truth reconciliation

Three remote BR-03 migration ledger entries were created while forced rotation was being evaluated. The final remote schema removes that temporary scaffolding. Matching repository migrations are intentionally inert reconciliation records so clean resets preserve the exact ledger without recreating password-rotation objects.
