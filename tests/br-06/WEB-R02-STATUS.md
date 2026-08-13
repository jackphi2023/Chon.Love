# WEB-R02 — Seeking UI Final QA

Release branch QA contract:

- Widths: 390, 430, 768, 1024, 1280, 1440.
- Public/auth: Homepage, Login, Signup.
- Onboarding: 18+ gate, profile setup, selfie camera entry.
- Core Luxy: Search, Filter, Member Profile, Interests, Messages, Chat, Edit Profile.
- Paid/privacy: Membership, Upgrade gate, VietQR checkout, Verification, Private Photos.
- Every captured R02 surface checks horizontal overflow before screenshot evidence is attached.
- Member Profile asserts no nested interactive buttons; photo-open and Favorite remain separate controls.
- Onboarding upload/continue controls and gender/province choices expose explicit web accessibility semantics.
- Chat must load the seven-day retention switch without a red fallback error. The client normalizes the legacy SQL disabled value `NULL` to semantic `false` and has a unit regression for both read and disable-update responses.
- Upgrade and VietQR dialogs use the shared Luxy modal layer; browser QA asserts that the dialog remains above underlying page content with hit-testing at runtime.
- Profile/media screenshot rendering uses a deterministic browser-only visual fixture so screenshots validate card/profile hierarchy rather than a transparent 1×1 local storage seed asset. Authorization and media metadata still come from local Supabase.
- VietQR screenshot rendering uses a deterministic browser-only image fixture; order creation, amount, transfer content and checkout state continue to come from the real local Supabase LX-18 contract.
- Live provider/image delivery remains a WEB-R05 Netlify HTTPS smoke requirement.

This status file contains no production credentials or fixture passwords.
