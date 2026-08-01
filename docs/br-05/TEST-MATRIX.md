# BR-05 Test Matrix

## Actors

| Actor | Role in contract |
|---|---|
| Creator | Approved adult Creator; owns posts, media, and albums |
| Friend | Accepted friend without Fan membership |
| Fan | Active and later revoked Fan membership |
| Stranger | Active adult without relationship |
| Moderator | Adult account with the moderator role |
| Anonymous | No authenticated user ID |

## Creator Activity lifecycle

- Create pending text, image, and normalized YouTube video posts.
- Owner can inspect pending posts; other viewers cannot.
- Ordinary users cannot moderate.
- Moderator queue includes submitted posts.
- Approval publishes posts; image approval requires approved media and ready preview.
- Rejected and archived posts remain visible to the owner but not viewers.
- Deleted posts disappear from every Activity list.

## Privacy matrix

| Visibility | Anonymous | Stranger | Accepted friend | Active Fan | Owner |
|---|---:|---:|---:|---:|---:|
| Public | Allow | Allow | Allow | Allow | Allow |
| Friends | Deny | Deny | Allow | Allow | Allow |
| Fans | Deny | Deny | Deny unless also Fan | Allow | Allow |

Additional transitions:

- Blocking overrides friendship and Fan membership.
- Unblocking restores access only when the underlying relationship or membership is still active.
- Revoking Fan membership immediately closes Fan-only Activity and album access.
- Public highlights include only Creators whose Activity visibility is public.

## Activity album and media

- The Activity-derived album includes only approved, published, non-deleted image posts with approved media.
- Feed and album use the same Creator-level privacy gate.
- Original media access is denied when Activity access is denied or users are blocked.

## Public and Fan profile albums

- Approved public media in an active public album is visible to active adult users.
- Fan media requires an active Fan membership.
- Blocking, album deactivation, media removal, deletion, and moderation state all close access.

## Reporting

- A viewer without Activity access cannot report a guessed post UUID.
- An authorized viewer can report visible posts and images.
- Duplicate reports are throttled.
- Blocked viewers cannot report hidden content.

## Isolation and exclusions

- Five fixture users use deterministic non-Beta UUIDs and `.example.test` emails.
- The contract ends with `ROLLBACK`.
- No service-role key or controlled Beta password is read.
- Gift, Play Billing, withdrawal, and VietQR operations are excluded.
