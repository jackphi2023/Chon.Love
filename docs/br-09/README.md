# BR-09 — Observability, Accessibility and Resilience

BR-09 adds a privacy-safe runtime quality layer across Mobile Web, Android/iOS source, Admin and Public Web. It is stacked on the validated BR-08 head and does not enable financial activity.

## Observability

- authenticated, fail-closed ingestion into an immutable private table;
- bounded event names, route groups, error codes and primitive metadata allowlist;
- explicit rejection of PII, credentials, purchase tokens, exact location, message content, KYC and bank data;
- rate limiting, idempotent event IDs and 30-day retention;
- super-admin aggregated snapshot only;
- external observability vendor and Edge Function deployment remain unauthorized.

## Accessibility

- WCAG AA contrast tests and 44-point minimum touch targets;
- accessible names, roles, states and live regions on critical mobile auth/error states;
- keyboard-visible focus, skip links and focus recovery on Admin/Public Web;
- reduced-motion CSS and browser contract.

## Resilience

- transient read/idempotent operations may retry at most twice with bounded jitter;
- circuit breaker primitive for repeated transient failures;
- auth, non-idempotent writes and all financial operations never auto-retry;
- offline/recovered signals do not interrupt user flows;
- all recovery actions remain manual for mutations.
