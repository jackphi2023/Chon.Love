# Security boundaries

- `main` and `develop` are not updated by BR-01.
- The active Supabase project keeps all existing user and business data.
- No frontend receives a service-role or secret key.
- Beta seed and password-reset functions are non-operational tombstones.
- RPC-only tables remain inaccessible through direct Data API table queries.
- Financial feature flags remain disabled until their dedicated E2E sessions pass.
