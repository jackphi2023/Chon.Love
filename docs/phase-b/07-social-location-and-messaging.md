# Phase B — Session 7: Social Location and Messaging

## 1. Scope

Session 7 adds privacy-preserving location discovery, friendships, blocks, reports, direct conversations and text messaging on the canonical MyFan Supabase project:

```text
Project: MyFan MobileApp
Project ref: asnydvqsduonyidjyyzq
Region: ap-southeast-1
```

The same Supabase Auth users, public schema, RPC contracts, generated TypeScript types and Realtime publications are consumed by Expo Web, Android and iOS. There is no platform-specific backend or duplicated business logic.

## 2. Cross-platform synchronization

All user clients import `@myfan/supabase`:

- Mobile Web uses the browser Supabase client and URL-session detection.
- Android and iOS use the same client factory with a native storage adapter and URL-session detection disabled.
- All platforms call the same RPCs for location, discovery, friendships, blocks, reports and messages.
- All platforms subscribe to the same RLS-protected Realtime tables.
- `client_message_id` provides cross-device idempotency for message retries.

Realtime is enabled only for:

```text
public.friendships
public.conversation_members
public.messages
```

It is not enabled for exact locations, identity, roles, configuration or audit data.

## 3. Location architecture

### Device

Phase C will use foreground-only device location:

```text
Expo: expo-location
Android: Fused Location Provider
iOS: Core Location
```

Session 7 provides the backend contract. It does not request native location permission or run background tracking.

### Server

Exact coordinates are stored only in:

```text
private.user_locations.location geography(Point, 4326)
```

The table includes accuracy, capture time, consent time, source, enabled state and expiry. `anon` and `authenticated` have no schema access or direct table privileges.

`set_my_location`:

- Requires an authenticated active adult.
- Only writes `auth.uid()`.
- Validates latitude, longitude, accuracy, source and capture time.
- Uses longitude before latitude when building the point.
- Applies a 30-second database rate limit.
- Reads accuracy and stale thresholds from `private.app_config`.
- Returns status timestamps, never coordinates.
- Writes a coordinate-free location audit event.

`disable_my_location` stops Nearby eligibility immediately and records a coordinate-free audit event.

### Nearby

`find_nearby_profiles`:

- Uses the caller's stored location only.
- Clamps radius to `location_max_radius_meters`.
- Clamps result limit to 50.
- Uses `ST_DWithin`, `ST_Distance` and a GiST index.
- Excludes the caller, stale or disabled locations, low-quality locations, inactive/unapproved/deleted users and two-way blocks.
- Returns public profile fields and a distance bucket only.
- Does not return latitude, longitude, exact meters, bearing or map pins.

Distance values:

```text
under_1km
1_to_3km
3_to_5km
5_to_8km
8_to_15km
over_15km
```

Province discovery uses `profiles.province_id`; no reverse geocoding or maps API is used.

## 4. No Google Maps dependency

V1 uses no:

- Google Maps API.
- Google Places API.
- Google Geocoding API.
- Google Distance Matrix or Routes API.
- Google Maps SDK.
- Public OpenStreetMap API for distance calculations.

PostGIS performs all server-side distance filtering. V1 renders list-based discovery, not a map.

## 5. Social graph

### Friendships

`public.friendships` normalizes each pair with generated low/high user IDs. A partial unique index prevents pending or accepted reverse duplicates.

Supported states:

```text
pending
accepted
declined
cancelled
```

Protected RPCs enforce:

- No self request.
- Active adult accounts only.
- No request across a block.
- Greeting length at most 280 characters.
- Only the addressee can accept or decline.
- Only the requester can cancel a pending request.

Accepting a request atomically creates one direct conversation and two membership rows.

### Blocks

`block_user`:

- Creates or updates the caller's block.
- Never reveals an internal reason to the blocked user.
- Cancels pending or accepted friendship state.
- Removes the pair from Nearby and province discovery.
- Prevents new friendship requests and messages.

Unblocking does not automatically restore friendship or chat permission.

### Reports

`create_report` accepts exactly one target type. Users can submit reports through RPC and retrieve only a summary of their own reports through `get_my_reports`. Internal priority, assignment, evidence and resolution details are not directly readable by user clients.

`target_media_id` is reserved for Session 8 and receives its foreign key when `media_assets` exists.

## 6. Direct messaging

V1 supports direct chat only. There is no group, anonymous or random chat.

A message is accepted only when:

- Sender is a conversation member.
- Friendship is still accepted.
- No block exists in either direction.
- Sender is an active adult.
- Body is non-empty and at most 2,000 characters.

`client_message_id` is unique per sender. Retrying the same client operation returns the existing row instead of creating a duplicate.

Gift/system message columns are schema placeholders. User clients can create text messages only; gift messages will be linked to verified gift transactions in Session 9.

## 7. Public and private objects

### Private

```text
private.user_locations
private.location_events
```

### Public with RLS

```text
public.friendships
public.user_blocks
public.reports
public.conversations
public.conversation_members
public.messages
```

User-facing mutation is RPC-only. Direct table inserts, updates and deletes are revoked.

## 8. RPC contract

```text
set_my_location
disable_my_location
find_nearby_profiles
find_province_profiles
send_friend_request
respond_to_friend_request
cancel_friend_request
block_user
unblock_user
create_report
get_my_reports
send_message
mark_conversation_read
```

The shared package exposes typed wrappers and Realtime helpers so Mobile Web, Android and iOS use identical parameter names and return types.

## 9. Migrations

Remote migration history:

```text
20260729170755_phase_b_07_social_location_messaging.sql
20260729170804_phase_b_07_policy_helper_permission.sql
20260729171149_phase_b_07_add_last_read_index.sql
```

The helper permission grants only `EXECUTE` on a boolean membership function needed by RLS. It does not grant `USAGE` on the private schema or access to any private table.

## 10. Tests

### Local GitHub Actions

```text
Supabase start: PASS
Database reset from empty: PASS
Seed: PASS
Session 6 pgTAP: 18/18 PASS
Session 7 pgTAP: 33/33 PASS
Schema lint: PASS
Generated public contract: PASS
Application lint/typecheck/unit tests: PASS
```

Session 7 tests cover:

- Exact-location access denial.
- Invalid coordinates.
- 8 km and 15 km discovery.
- Stale-location exclusion.
- Block exclusion.
- Self and reverse friendship rejection.
- Addressee-only acceptance.
- Conversation creation after acceptance.
- Chat rejection before acceptance.
- Idempotent client message ID.
- Outsider message denial.
- Message denial after block.
- Report submission.
- Realtime publication scope.

### Remote smoke test

A two-user transaction produced:

```text
Nearby in 8 km: 1
Friendships: 1
Conversations: 1
Conversation members: 2
Messages: 1
```

The transaction was rolled back. Persistent state after testing:

```text
Auth users: 0
Exact locations: 0
Friendships: 0
Messages: 0
```

### Performance test

A rollback-only test seeded 1,500 points. The 8 km query used:

```text
Index Scan using user_locations_location_gist
Index Cond: location && _st_expand(...)
ST_DWithin filter
```

The query did not load every location before distance filtering.

## 11. Advisor review

Performance Advisor identified the missing index for `conversation_members.last_read_message_id`; migration `20260729171149` adds a partial index.

Remaining unused-index INFO notices are expected while the application tables are empty.

Security Advisor lists private tables without policies because the private schema is intentionally revoked, with RLS enabled as defense in depth. It also lists authenticated `SECURITY DEFINER` RPCs; these are intentional API boundaries that use `auth.uid()`, schema-qualified objects, empty search paths and narrowly granted execution.

## 12. Known limits

- Native foreground permission UI is implemented in Phase C, not Session 7.
- API gateway/device abuse controls should supplement the database location rate limit.
- Message edit/delete operations are not exposed in V1 yet.
- Media and image messages wait for Session 8 moderation.
- Gift messages wait for Session 9 verified transactions.
- Realtime reconnect/offline queue behavior must be tested in native development builds.

## 13. Acceptance decision

```text
SESSION 7 COMPLETE
READY FOR SESSION 8
```

The database supports privacy-preserving discovery and friendship-gated direct messaging from one canonical backend for Mobile Web, Android and iOS.
