# Phase C / Session 17 — Profile viewer and social safety

## Scope

Session 17 combines the profile-viewer milestone from the roadmap with the detailed social-safety session specification:

- view another user's public-safe profile
- view public album media through private Storage signed URLs
- show Fan Album eligibility and load Fan media only after server authorization
- send, accept, decline and cancel friendship requests
- list friends, received requests and sent requests
- block and unblock users
- report users and visible media using explicit reason codes
- request and cancel account deletion through the Phase B server operations

Chat and gift actions remain disabled for later sessions.

## Profile privacy

The viewer contract does not return email, date of birth, exact location, KYC, bank details or moderation history. Avatar and album Storage locators are used only inside the authenticated client to request short-lived signed URLs and are never rendered as text or written to analytics.

A profile is not returned when its owner has blocked the viewer. When the viewer has blocked the profile, avatar, albums, friendship and Fan access are hidden until the viewer explicitly unblocks the account.

## Fan Album

Fan Album access remains server-authoritative:

```text
active adult account
+ approved Creator
+ active Fan Album
+ active Fan membership
+ no block in either direction
+ viewable media status
= Fan Album media returned
```

The locked state displays eligible support progress in ❤️ only. It does not promise meetings, relationships, private contact or adult content. Fan media follows the same Community Standards as public media.

## Friendship state

```text
none
→ pending outgoing/incoming
→ accepted | declined | cancelled
```

Only accepted friendships will be eligible for realtime chat in Session 19. Blocking cancels pending or accepted friendship state through the existing Phase B operation.

## Reports

Allowed reason codes:

- `spam`
- `harassment`
- `impersonation`
- `sexual_content`
- `underage`
- `scam`
- `violence`
- `other`

The server requires exactly one report target, validates media/message visibility, limits descriptions to 1,000 characters and rejects an identical report submitted within 60 seconds.

## Account deletion

The app calls the Phase B account-deletion RPC rather than merely logging out. A request immediately disables Discovery, Nearby and the social profile. During a cancellable grace state, the user can reopen the deletion-status screen after login and cancel the request. Legal or financial holds are shown without exposing private financial details.

## Database migration

```text
20260730063726_phase_c_17_profile_viewer_social_safety.sql
```

New authenticated RPCs:

- `get_profile_viewer`
- `list_my_social_connections`
- `list_my_blocked_profiles`

The migration also hardens `create_report` with an explicit reason-code allowlist and rate limiting. `PUBLIC` and `anon` execution are revoked from all four functions.

## Client files

- `packages/supabase/src/social-safety.ts`
- `packages/supabase/src/social-safety.test.ts`
- `apps/mobile/app/profile/[username].tsx`
- `apps/mobile/app/(tabs)/friends.tsx`
- `apps/mobile/app/settings/account-deletion.tsx`
- `apps/mobile/src/components/social-avatar.tsx`

## Verification targets

- profile hidden when target blocked viewer
- blocked profile has no avatar or album access
- Fan media not queried without `fan_access_granted`
- friendship action matches server state
- block invalidates Discovery/profile/social caches
- report reason codes match the server allowlist
- account deletion remains cancellable after app restart when server permits it
- no chat before accepted friendship
- no public bucket or permanent media URL
