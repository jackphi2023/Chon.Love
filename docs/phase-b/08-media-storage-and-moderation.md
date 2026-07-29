# Phase B — Session 8: Media, Storage and Moderation

## 1. Canonical backend

All Mobile Web, Android and iOS clients use the same backend:

```text
Project: MyFan MobileApp
Project ref: asnydvqsduonyidjyyzq
Region: ap-southeast-1
```

The clients share one Supabase Auth population, database contract, Storage namespace, moderation state machine, Edge Functions and Realtime publications.

## 2. Scope

Session 8 adds:

- Image upload preparation and finalization.
- Private Supabase Storage buckets.
- Moderation before public display.
- Avatar, public album, Fan album and owner-private media.
- Immutable moderation audit events.
- Short-lived authorized media URLs.
- Cross-platform upload, album, access and Realtime helpers.

KYC storage is reserved and private. Client KYC upload and review are implemented with the dedicated KYC flow in a later session; general media access never returns KYC content.

## 3. Storage buckets

```text
pending-media   private, 10 MB, JPEG/PNG/WebP
profile-media   private, 10 MB, JPEG/PNG/WebP
kyc-private     private, 15 MB, JPEG/PNG/WebP/PDF
```

All paths are server-generated:

```text
{owner_user_id}/{media_id}/{filename}
```

User clients may upload only a previously prepared object in their own `pending-media` path. There is no Storage UPDATE policy, so client upsert/overwrite is denied. Approved media is copied to `profile-media` by the moderation Edge Function using server credentials.

## 4. Database objects

### Public with RLS

```text
public.media_assets
public.albums
public.album_media
public.moderation_cases
```

### Private

```text
private.media_moderation_events
```

`private.media_moderation_events` is append-only. An UPDATE or DELETE attempt raises `media_moderation_events_are_immutable`.

## 5. Media lifecycle

```text
pending_upload
  → pending_review
  → approved | rejected | quarantined
  → pending_review (restore)
  → deleted
```

Rules:

- Upload metadata is created before the object upload.
- Finalization requires the matching owner-scoped Storage object.
- Finalization creates a moderation case.
- Pending or rejected media never appears to another user.
- Avatar replacement occurs only after approval.
- Approved media must be in `profile-media`.
- User deletion is a soft delete with an immutable audit event.
- A stable request ID makes owner deletion idempotent across devices.

## 6. Album access

Album types:

```text
public
fan
```

An album may contain only media owned by the same user and with matching visibility. Avatar, private and KYC media cannot be placed in albums.

Public album access requires:

- Approved media.
- Active adult owner and viewer.
- Active album.
- No block in either direction.

Fan album access additionally requires an active Fan membership. The helper is forward-compatible with the `public.fan_memberships` table created by the heart/gift session. Until that table exists, only the owner can view Fan media.

## 7. Signed media access

`media-access` is a JWT-protected Edge Function.

It:

1. Verifies the caller's access token.
2. Calls `can_view_media` with the caller's RLS context.
3. Reads the Storage path only with server credentials.
4. Rejects KYC, quarantined and deleted content.
5. Returns a signed URL valid for 30–300 seconds, default 120 seconds.
6. Returns no bucket or object path to the viewer.
7. Uses `Cache-Control: private, no-store` for the authorization response.

All buckets remain private; there are no permanent public URLs.

## 8. Moderation orchestration

`media-moderation` is a JWT-protected Edge Function.

It:

- Requires authoritative `moderator` or `super_admin` role.
- Copies an approved file from `pending-media` to `profile-media` with `upsert: false`.
- Calls the role-checked `moderate_media` RPC.
- Removes the copied object if the database transition fails.
- Removes the pending source after approval.
- Supports approve, reject, quarantine, restore and delete.
- Writes an immutable audit event for every successful decision.

No service or secret key is committed to the repository. Edge Functions read Supabase-managed environment variables.

## 9. Public RPC contract

```text
prepare_media_upload
finalize_media_upload
list_my_media
create_album
set_album_active
add_media_to_album
remove_media_from_album
list_profile_album_media
set_my_avatar
can_view_media
can_moderate_content
moderate_media
delete_my_media
```

## 10. Mobile Web, Android and iOS synchronization

All three platforms import `@myfan/supabase` and use the same generated `Database` type.

Shared media functions include:

- Prepare and upload an `ArrayBuffer` with `upsert: false`.
- Finalize upload for moderation.
- List owner media and moderation status.
- Create and manage albums.
- Request signed media access.
- Set an approved avatar.
- Soft-delete media idempotently.
- Invoke moderation from the Admin client.
- Subscribe to owner media and album changes.

`ArrayBuffer` is the common upload payload for browser and React Native. Platform-specific image pickers only convert the selected file into the shared input shape; business rules remain in the shared package and backend.

Realtime is enabled only for owner-facing metadata:

```text
public.media_assets
public.albums
public.album_media
```

Storage objects, KYC data, moderation cases and audit events are not published through Realtime.

## 11. Applied migrations

```text
20260729182255_phase_b_08_media_schema.sql
20260729182445_phase_b_08_media_access_policies.sql
20260729182509_phase_b_08_media_hardening.sql
20260729183126_phase_b_08_add_fk_indexes.sql
```

## 12. Tests

Local database tests cover:

- All buckets are private.
- MIME and file-size limits.
- No broad `true` Storage policy.
- Cross-user path upload denial.
- No client Storage UPDATE policy.
- Finalization requires an existing object.
- Pending avatar does not replace the approved avatar.
- Other users cannot read pending media.
- Client cannot self-approve.
- Moderator approval and immutable audit.
- Owner/album ownership consistency.
- Public album visibility.
- Non-Fan denial and active Fan access.
- Block revokes Fan access.
- Rejected media remains hidden.
- KYC denied through general media access.
- Soft deletion and idempotent retry.
- Realtime publication scope.

Session 8 test count:

```text
08_media_storage_moderation_test.sql: 40
08b_media_hardening_test.sql:         5
Total Session 8:                     45
```

Sessions 6–8 combined database test count is 96.

## 13. Remote state after deployment

Expected clean state before real users:

```text
Private buckets: 3
Storage objects: 0
Media rows: 0
Albums: 0
Moderation audit events: 0
```

The Edge Functions `media-access` and `media-moderation` are active with JWT verification enabled.

## 14. Advisor review

Performance Advisor foreign-key index findings are covered by `20260729183126`.

Remaining unused-index findings are expected while the tables are empty. Security Advisor reports intentional `SECURITY DEFINER` RPC boundaries and private tables without user policies. These boundaries use:

- `auth.uid()` ownership checks.
- Empty `search_path`.
- Schema-qualified objects.
- Narrow function grants.
- Revoked private-schema access.
- JWT-protected Edge Functions.

## 15. Limits and next dependencies

- Automated image-classification vendor integration is not enabled; moderation is queue/manual-first.
- Fan access becomes operational after the heart/gift session creates authoritative `fan_memberships`.
- KYC object upload and Admin KYC review use a dedicated later flow.
- Image picker, compression and native permission UI belong to the application UI sessions.
- CDN transformation presets and object-retention cleanup jobs are not enabled yet.

## 16. Acceptance

```text
SESSION 8 COMPLETE
READY FOR SESSION 9
```

The backend and shared contract provide one moderated media system for Mobile Web, Android and iOS without public buckets or duplicated platform logic.
