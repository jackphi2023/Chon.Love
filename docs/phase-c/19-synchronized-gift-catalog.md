# Phase C / Session 19 — Synchronized 20-gift catalog

## Status

Implemented on `feature/phase-c-session-19-gift-catalog` and based on the completed Session 18 branch. The feature remains in a draft pull request until automated CI and cross-platform QA pass.

## Product contract

Session 19 exposes one catalog to:

- Android / Expo native app.
- Authenticated Expo Web.
- Public Next.js web at `/qua-tang`.

All surfaces read from:

```text
public.gift_catalog
```

No separate web catalog, fixture catalog, or duplicated hard-coded price list is used.

## Final catalog

The database contains exactly 20 active gifts:

```text
display_hearts:    1 ... 20
heart_price_units: 100 ... 2,000
sort_order:        1 ... 20
```

The canonical icon fallback is stored in the admin-configurable `icon_emoji` column. `icon_media_id` remains available for a future approved media icon.

The product-wide development configuration remains:

```text
1 ❤️ = 100 heart_units
1 ❤️ = 50,000 VND
```

Social surfaces in this session never display the VND conversion. Only the heart amount is rendered.

## Migration safety

Migration:

```text
20260730083340_phase_c_19_gift_catalog_1_to_20_hearts.sql
```

The migration:

1. Preserves every existing gift UUID.
2. Reconciles the 20 existing rows rather than deleting and recreating them.
3. Adds the configurable `icon_emoji` fallback.
4. Updates names, slugs, heart price, display price and sort order.
5. Adds range and uniqueness constraints for the active V1 catalog.
6. Does not update `gift_transactions`.

Historical gift transactions already store:

```text
gift_slug_snapshot
gift_name_vi_snapshot
gift_name_en_snapshot
unit_heart_units
gross_heart_units
```

Therefore a future catalog edit does not rewrite transaction history.

## Shared client module

The repository already centralizes Supabase domain/query logic in `packages/supabase`, so Session 19 adds:

```text
packages/supabase/src/gifts.ts
```

instead of introducing another workspace dependency and lockfile importer.

The module owns:

- `GiftCatalogItem` validation.
- Active gift query.
- Central query keys.
- Ordering and inactive/deleted filtering.
- Session 19 contract checks.
- Heart-only price formatting.
- Authenticated safe balance query.

Android, Expo Web and public Next.js import the same module.

## Authenticated app behavior

Route:

```text
/(tabs)/gifts
```

The screen includes:

- Header `Cửa hàng quà`.
- 18+ indicator.
- Available ❤️ balance from `get_my_economy_summary`.
- Responsive two-column grid.
- Pull-to-refresh.
- Loading, error and empty states.
- Gift detail bottom sheet/modal.
- Local gift selection state.

`phaseCFeatureFlags.send_gift` remains `false`.

Consequently Session 19:

- Does not deduct balance.
- Does not create a `gift_transaction`.
- Does not create a chat gift message.
- Does not simulate payment success.
- Does not expose QR or bank transfer payment.

## Public web behavior

Route:

```text
/qua-tang
```

The public page:

- Reads the active catalog with the public Supabase client and active-row RLS policy.
- Shows 20 gifts and heart-only pricing.
- Does not query or show a user balance.
- Does not execute a gift transaction.
- Provides controlled loading, retry and empty states.
- Includes route metadata and Open Graph content.
- Explains that gifts do not buy meetings, private access, adult content or romantic relationships.

## Permissions

Current table access:

```text
anon          SELECT only
authenticated SELECT only
service_role  catalog administration
```

RLS policy:

```text
is_active = true
and deleted_at is null
```

Neither public nor authenticated clients can insert, update, delete or reactivate gifts.

## Cache and catalog updates

- Mobile/Expo Web uses TanStack Query with a 60-second stale window and pull-to-refresh.
- Public web refetches on mount and explicit retry.
- Admin catalog edits are visible on the next client refetch.
- No public client receives catalog write permission.
- Realtime subscription is intentionally not required for this low-frequency catalog.

## Tests

Shared unit tests cover:

- Active/deleted filtering.
- Sort order.
- Exact count of 20 gifts.
- Exact 1–20 heart sequence.
- Heart unit matching.
- Heart-only formatting with no VND string.
- Fractional heart balance formatting.

Database verification covers:

- 20 active rows.
- `display_hearts` 1–20.
- `heart_price_units` 100–2,000.
- `sort_order` 1–20.
- Non-empty configured icons.
- Zero client write grants.
- Existing `heart_vnd_rate = 50000`.

## Rollback guidance

Do not edit or remove the applied migration.

A forward rollback may:

1. Disable selected catalog rows.
2. Restore a previously approved display sequence through a new migration.
3. Keep gift UUIDs stable.
4. Never rewrite historical transaction snapshots.
5. Leave `icon_emoji` in place to avoid destructive schema rollback.

## Remaining beta QA

- Android physical-device rendering at 360–430 px widths.
- Expo Web mobile and desktop layout checks.
- Public Next.js page with real development environment variables.
- Screen reader order and dynamic font testing.
- Admin edit followed by app/public-web refetch.
- Future approved `icon_media_id` rendering contract.
