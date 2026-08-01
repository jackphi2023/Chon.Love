# MyFan Security Review

**Updated:** 2026-07-31  
**Review scope:** Creator Activity whole-feed privacy, private media, friendship, Fan membership, moderation and profile presentation.

## Security conclusion

Creator Activity uses a single server authorization predicate as the access boundary. Client state such as a selected privacy label, friendship badge, Fan badge, visible CTA or cached post is never accepted as proof of access.

`private.can_view_creator_activity(creator_id, viewer_id)` evaluates:

- approved active adult Creator,
- Creator-level privacy mode,
- current authenticated viewer where required,
- accepted friendship,
- active Fan membership,
- two-way block state,
- Creator self-access.

The predicate protects the complete Activity surface: text, image, external video/link data, derived album rows and Storage objects.

## Privacy tier review

- `public`: anonymous and authenticated adults may read approved Activity unless blocked.
- `friends`: only accepted friends and active Fans may read approved Activity.
- `fans`: only active Fans may read approved Activity.
- Creator owner: may read their own moderation states.
- block: overrides all relationship tiers.

A denied access RPC returns only gate metadata and Fan progress. It returns no post bodies, external URLs, image paths or nonzero private content counts.

## Gift and Fan integrity

Fan-only Activity reuses the existing atomic `send_gift` engine and cumulative Fan model.

The caller supplies Creator ID, active catalog gift ID, quantity and an idempotency key. The server:

- derives sender from `auth.uid()`;
- verifies active adult accounts and block state;
- verifies the approved Creator and active gift;
- calculates price, Creator reward and platform share server-side;
- debits immutable funded heart lots and ledger entries;
- updates cumulative `fan_progress`;
- activates `fan_memberships` only after the configured threshold is met.

Activity access is refreshed from active Fan membership after the transaction. The client cannot directly write Fan progress, Fan membership or Activity visibility.

The prior per-post `send_gift_and_unlock_creator_post` path is retired from client ACLs. Historical entitlement rows are retained only for migration and reconciliation.

The development frontend still has `google_play_billing=false` and `send_gift=false`. The UI does not simulate balance changes, successful gifts or Fan membership.

## Image and album protection

- Original Activity images use private media upload flows with `visibility=private`.
- The JWT-protected Edge Function creates a separate 64×64 preview for moderation and operational fallback.
- A privacy-denied viewer receives neither preview nor original path.
- `list_creator_activity_album` derives its rows only from approved Activity image posts.
- Archiving or deleting a post removes it from both feed and album queries.
- Storage policy rechecks the whole-feed privacy predicate before signed URL creation.
- Signed URLs expire after 30 seconds.
- No original signed URL is logged or embedded in denied public HTML.

This avoids both insecure client-side CSS blur and the inconsistent state where feed text is hidden but album images remain exposed.

## Profile presentation review

Activity privacy gates only the Activity and derived album section. The authenticated profile viewer still returns presentation fields needed to identify and evaluate a connection:

- name and username,
- server-calculated age,
- active account state,
- introduction and interests,
- province/city,
- approximate distance,
- online/offline and last-active state.

Private DOB and exact coordinates are not returned. Distance requires:

- both users have a non-null matching province,
- both locations remain enabled and unexpired,
- both captures are fresh,
- only rounded kilometers are returned.

A profile owner blocking the viewer still prevents profile disclosure. A viewer who has blocked the target receives basic identification but no Activity.

## URL and SSRF review

Accepted URLs must use HTTPS and match one of:

- YouTube watch URLs;
- youtu.be URLs;
- YouTube shorts/embed URLs;
- OF.TV content paths.

YouTube URLs are normalized to an 11-character video ID. OF.TV remains an external-link card with an interstitial and is not embedded in a WebView.

The server does not perform arbitrary metadata retrieval, follow caller-controlled redirects or resolve arbitrary hosts. Tests reject HTTP, arbitrary domains, localhost, loopback and look-alike YouTube domains.

No email, internal user ID, access token, purchase token or location is appended to an external URL.

## Moderation review

- All posts start `pending_review`.
- Text, external link and image are reviewed before publication.
- An image post cannot be approved until original media is approved and the server preview is ready.
- Moderator and super-admin operations use role-checked RPCs.
- Approve/reject actions write before/after values and request ID to private Admin audit logs.
- Users can report a post, image or external link; duplicate reports within 60 seconds are rate limited.

Privacy mode is not a moderation decision and does not weaken content policy.

## RLS and ACL review

- RLS remains enabled for all Activity public and private tables.
- `anon` and `authenticated` have no direct writes to Activity or historical entitlement tables.
- `set_my_creator_activity_visibility` requires authenticated approved Creator ownership.
- `get_creator_activity_access`, approved feed, approved album and media-access RPCs may be called anonymously but perform explicit server authorization.
- Creator writes, gifts, reports and Admin operations require authentication.
- SECURITY DEFINER functions use fixed empty `search_path` and explicit identity or role checks.
- Legacy per-post unlock RPC execute was revoked from `anon` and `authenticated`.

## Public web review

The static-export-compatible route is `/hoat-dong?u=username` and is `noindex`.

- `public` returns approved feed and album.
- `friends` and `fans` return a gate only for anonymous visitors.
- The public page cannot execute an anonymous gift.
- A denied page receives no preview or original Storage path.

## Known limitations requiring beta QA

The development database currently has no profiles, posts, friendships, Fan memberships, gifts or moderator fixtures. End-to-end validation remains required for:

- public/friend/Fan visibility across multiple accounts;
- friendship acceptance and immediate cache invalidation;
- Google Play-funded gifts and Fan threshold progression;
- refund/reversal effects on active Fan membership;
- two-way block behavior;
- real image upload and Edge preview generation;
- Activity-derived album ordering and archive removal;
- same-province, missing-province and outside-province distance states;
- moderator login and decision workflow;
- exact signed URL expiry on physical clients;
- accessibility and dynamic-font behavior.

Production release should not proceed until these fixture and device checks pass.
