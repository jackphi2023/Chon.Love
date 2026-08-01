# Phase C / Session 16 — Province and Nearby Discovery

## Implemented behavior

- Two discovery modes: `Gần đây` and `Theo tỉnh`.
- Nearby ordering is calculated in PostgreSQL/PostGIS, never by downloading coordinates to the client.
- Same-province profiles with fresh enabled locations are ordered by distance.
- Distance is returned only as `< 1 km` or a one-decimal kilometre value such as `1,5 km` and `2,6 km`.
- Same-province profiles without an eligible location remain visible after the distance-ranked group.
- Profiles outside the viewer's province remain visible at the end without a distance label.
- Blocked, inactive, underage, deleted and discovery-disabled profiles are excluded server-side.

## Cache and pagination

- TanStack Query stale time: 30 minutes.
- Discovery context and every mode/filter page use the same 30-minute cache window.
- Default page size: 24 profiles.
- The next page is fetched only when the user scrolls near the end of the current list.
- Maximum profiles loaded in one discovery session: 200.
- Initial and next-page states display `Đang tải…`.
- Manual pull-to-refresh is still available as an explicit user action.

## Location adapters

### Native

- Uses `expo-location` foreground permission only.
- Permission is requested only after the user selects the location action.
- Reuses a last-known location only when it is at most 30 minutes old and within the accepted accuracy limit.
- Falls back to one balanced foreground position request.
- No background tracking.

### Expo Web

- Uses `navigator.geolocation` only after a user action.
- Uses a 30-minute `maximumAge` and a bounded timeout.
- Handles denied, unavailable, timeout and unsupported states.

## Privacy

- Raw latitude and longitude are sent directly to the secure location RPC and are not placed in query keys, analytics or logs.
- Exact coordinates remain in `private.user_locations`.
- Discovery RPCs return no coordinates, address, bearing or exact meter distance.
- The client receives only the rounded display distance for eligible same-province users.
- Turning location off does not remove access to Nearby or province discovery.

## Database

Migrations:

- `20260730054629_phase_c_16_discovery_nearby_ranked_cache.sql`
- `20260730055514_phase_c_16_discovery_query_optimization.sql`

RPCs:

- `get_my_discovery_context()`
- `list_discovery_profiles(mode, province_id, limit, offset)`
- existing `set_my_location(...)`
- existing `disable_my_location()`

The optimized Nearby tier uses the PostGIS GiST KNN operator inside the database, bounds each tier before merging, and exposes at most 200 results.

## Administrative areas

The development database now contains the 34 active province-level administrative units effective from 1 July 2025. The list is read from `public.administrative_areas`, not hard-coded in UI components.

## Deferred verification

The development database currently contains no user/location fixtures, so authenticated multi-user device E2E and real-world latency measurement remain for beta QA. Automated tests cover distance formatting, cache constants, pagination limits, deduplication and location error handling.
