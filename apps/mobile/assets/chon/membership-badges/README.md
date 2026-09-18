# Chọn.Love membership badge assets

UI-ASSET01 keeps membership artwork behind `ChonMembershipBadge` and `chon-membership-badge-assets.ts`.
Screens must not import these files directly.

## Semantic asset groups

- `premium-16.png` / `diamond-16.png`: mobile Connect/mini source artwork, rendered at 24px in Connect and 12px in mini contexts.
- `premium-26.png` / `diamond-26.png`: desktop Connect/Profile source artwork, rendered at 26px in desktop Connect and 32px on member Profile.
- `premium-160.png` / `diamond-160.png`: large certificate artwork for Membership surfaces.

All six files have transparent backgrounds. Semantic contexts select an appropriate source and downscale while preserving aspect ratio; certificate artwork uses `resizeMode="contain"` so it is never stretched or cropped.

## Future Admin contract

An Admin badge manager should replace/version the asset source by semantic key (`premium|diamond` × `icon-mobile|icon-desktop|certificate`) rather than storing page-specific URLs. Upload validation should enforce an image allowlist, transparent-capable format, non-zero dimensions, safe file size and preview at the canonical mobile, desktop and large contexts before publish.
