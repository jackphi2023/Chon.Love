# LX-09 — Search Backend V2 — Completion Status

Status: **Complete**

Implementation branch: `agent/luxy-seeking-ui-foundation`

LX-09 database/client contract is included in the LX-10 implementation-tested head: `a23a0a6b53a51c95fb2ebb69ef7ddf6d1068a632`.

Previous completed implementation session: LX-08.

## Objective

Provide the server-side and shared-client search contract required by the Seeking-style Luxy Search UI without leaking private identity/location data or rewriting the existing discovery stack before the desktop/mobile Search sessions.

The contract follows the Luxy product rule that location ranking is nationwide near → far, while the canonical 34 Vietnam provinces remain an independent filter.

## Database contract

Added forward-only migration:

- `supabase/migrations/20260811161500_lx_09_search_backend_v2.sql`

It introduces authenticated RPC:

- `public.search_luxy_profiles_v2(...)`

Supported filter dimensions include:

- canonical province;
- maximum distance;
- age range;
- gender;
- height and weight ranges;
- relationship status;
- children status;
- smoking;
- drinking;
- education;
- Luxy lifestyle/relationship tags;
- languages;
- interests;
- has-photo;
- online-now;
- occupation text;
- public profile text;
- bounded pagination.

Supported sort modes are:

- `distance` — default, nearest first;
- `recent` — recent activity;
- `newest` — newest member first.

## Location behavior

Search V2 uses the existing private PostGIS location data to calculate ranking across Vietnam.

Rules are:

1. candidates with valid shared location are ordered nearest → farthest for the default sort;
2. candidates without shared location remain searchable but sort after located candidates;
3. `province_id` is an independent filter and is not treated as a replacement for distance;
4. a maximum-distance filter excludes candidates without a measurable distance;
5. distance returned to clients is rounded kilometres, suitable for UI such as `0,7 km` or `2,3 km`.

The Search RPC does not return another member's latitude or longitude.

## Privacy boundary

The function joins private identity/location information only inside the database where needed for filtering/derivation.

The public result contract intentionally exposes:

- derived age, not date of birth;
- rounded `distance_km`, not exact coordinates;
- public profile fields;
- public avatar storage references;
- derived online state.

It does not expose:

- DOB;
- latitude;
- longitude;
- raw identity/KYC data.

Two-way block relationships are excluded from Search V2.

Anonymous execution is revoked; the RPC is available to authenticated/service roles only.

## Shared typed client

Added:

- `packages/supabase/src/search.ts`
- `packages/supabase/src/search.test.ts`

Exported through:

- `packages/supabase/src/index.ts`

The client provides:

- Zod validation for Search input/result;
- bounded page sizes and maximum result window;
- typed `search_luxy_profiles_v2` RPC arguments from generated `Database` types;
- `formatLuxyDistance(...)` for Vietnamese one-decimal distance presentation;
- pagination offset helper.

`packages/supabase/src/database.types.ts` was regenerated from a clean local Supabase rebuild and now contains the LX-09 RPC contract. The database workflow's generated-contract comparison passes.

## Database test contract

Added:

- `supabase/tests/lx_09_search_backend_v2.sql`

The pgTAP suite covers:

- authenticated/anonymous RPC ACL;
- no DOB/coordinate fields in result signature;
- nationwide near → far ordering;
- candidates without location after located candidates;
- rounded distance;
- cross-province distance;
- maximum-distance behavior;
- canonical province filtering;
- age filtering from private DOB;
- physical/lifestyle/profile filters;
- online/photo filters;
- recent/newest sorting;
- bounded pagination;
- block exclusion;
- invalid sort/range/distance rejection.

During implementation the tests caught two fixture/contract issues that were fixed without loosening production behavior:

1. fixture UUID values were normalized to valid UUIDs;
2. named pgTAP RPC arguments that map to PostgreSQL `smallint` parameters were explicitly cast instead of relying on integer literals.

## Final validation

Database workflow run `31512982323` completed successfully on implementation-tested head `a23a0a6b53a51c95fb2ebb69ef7ddf6d1068a632`.

It passed:

- clean database reset from repository migrations;
- BR-01 through BR-09 database/security contracts;
- LX-07 profile schema contract;
- LX-09 Search Backend V2 pgTAP contract;
- concurrent gift and withdrawal tests;
- schema lint;
- public database type generation;
- committed generated-type verification;
- application workspace verification.

Application CI also remains green with the typed Search client.

## Deliberate deferrals

LX-09 does not invent storage/semantics for filters whose owning roadmap sessions are later:

- favorites/favorited-me/viewed/viewed-me → LX-12;
- profile verification status such as selfie/CCCD → LX-20.

The LX-10 UI may display those Seeking-derived filter concepts as disabled roadmap affordances, but the Search V2 RPC does not claim they are functional before their data contracts exist.

## Safety / release boundary

- No migration already applied was edited.
- No private location coordinates were added to a public response.
- No membership, gift, payout or messaging entitlement was activated.
- `main` was not merged.
- Production was not deployed.
