# WEB-R02 — Seeking UI Final QA

Release branch QA contract:

- Widths: 390, 430, 768, 1024, 1280, 1440.
- Public/auth: Homepage, Login, Signup.
- Onboarding: 18+ gate, profile setup, selfie camera entry.
- Core Luxy: Search, Filter, Member Profile, Interests, Messages, Chat, Edit Profile.
- Paid/privacy: Membership, Upgrade gate, VietQR checkout, Verification, Private Photos.
- Every captured R02 surface checks horizontal overflow before screenshot evidence is attached.
- Member Profile asserts no nested interactive buttons.
- Upgrade and VietQR dialogs assert that their modal layer stays above underlying page content on web.
- VietQR screenshot rendering uses a deterministic browser-only image fixture; order creation, amount, transfer content and checkout state continue to come from the real local Supabase LX-18 contract.

This status file contains no production credentials or fixture passwords.
