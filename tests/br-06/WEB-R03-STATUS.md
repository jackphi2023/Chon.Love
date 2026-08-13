# WEB-R03 — Branding Cleanup

Release branch branding contract for Luxy Web V1:

- Product-facing brand is `Luxy.Love` across reachable Public Web, Expo Web core surfaces, legal copy and Admin shell.
- Public Web no longer positions the product as a Social Creator/Fan network; it presents the current 18+ selective-connection product with profile verification, Search, direct messaging, Premium/Diamond and Private Photos.
- Public legacy Activity route redirects to the homepage.
- Public Gift route is explicitly unavailable while the launch gift flag remains off; no fake transaction or entitlement is displayed.
- Core Expo Web surfaces must not expose `MyFan`, `LX-xx`, `Album Fan` or the deferred `Hoạt động` feature branding.
- Search uses neutral `Truy cập gần đây` wording instead of legacy Activity terminology.
- Member Profile no longer imports or renders the legacy Creator Activity component.
- User-visible Premium/Diamond, verification, private-photo and payment copy no longer references internal LX phase numbers.
- Legacy technical identifiers remain unchanged where renaming would break compatibility or migration history: `@myfan/*` workspace packages, environment variable names, app scheme/package identifiers, RPC/database fields, migration names, VietQR transfer prefix, and internal legacy Activity/Creator/Fan APIs retained for historical data compatibility.
- `scripts/validate-web-r03-branding.mjs` is the permanent source guard and conforms to repository lint rules.
- `tests/br-06/web-r03-branding.spec.mjs` is the permanent browser regression guard.
- WEB-R03 does not deploy or mutate production Supabase data/schema.
