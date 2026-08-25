# Chọn.Love membership badge assets

UI-ASSET01 keeps membership artwork behind `ChonMembershipBadge` and `chon-membership-badge-assets.ts`.
Screens must not import these files directly.

## Semantic asset groups

- `premium-16.png` / `diamond-16.png`: compact mobile member-card status artwork.
- `premium-26.png` / `diamond-26.png`: compact desktop member-card status artwork.
- `premium-160.png` / `diamond-160.png`: large certificate artwork for Membership/profile-class surfaces.

All six files have transparent backgrounds. The 16/26 renderers preserve each source aspect ratio; the large renderer uses `resizeMode="contain"` inside the stable Membership certificate slot so the artwork is never stretched or cropped.

## Future Admin contract

An Admin badge manager should replace/version the asset source by semantic key (`premium|diamond` × `icon-mobile|icon-desktop|certificate`) rather than storing page-specific URLs. Upload validation should enforce an image allowlist, transparent-capable format, non-zero dimensions, safe file size and preview at the canonical mobile, desktop and large contexts before publish.
