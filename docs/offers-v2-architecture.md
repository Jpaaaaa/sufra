# Offers V2 Architecture

Production architecture for the Offers Management Center (branch work: `feat/combo-fixed-trays`).

## Goals

- Unified admin UX (summary → filters → list → drawers)
- Shared pure domain for status + pricing
- Backend RBAC (`admin` | `manager`) on IPC + HTTP mutate
- Combo as fixed locked tray with reopen persistence
- Soft archive (`archived_at`) instead of hard delete for primary flows
- Lightweight `offer_audit_log`

## Domain modules

Location: `electron/shared/offers/` (FE alias `@sufra-offers`)

| Module | Role |
|--------|------|
| `offer-domain.ts` | Status resolver, weekday/time helpers, savings |
| `offer-pricing-resolver.ts` | Effective price: **Daily → Happy Hour → Scheduled → catalog** |
| `combo-price.ts` | Merge qty, sum vs fixed (integer IQD) |
| `offer-view-model.ts` | Map 5 DB types → unified list row |

FE wrappers: `frontend/src/lib/offers/` (+ `build-offers-category-items.ts` for POS).

## Pricing policy

Product tile / cart enrichment priority (FE and BE aligned):

1. Active daily deal (today, not archived)
2. Active happy hour (weekday + time window, overnight supported)
3. Active scheduled offer for that product
4. Catalog price

Combo tile / tray head:

1. Active scheduled offer on `combo_id`
2. Combo `combo_price` (fixed or sum-of-contents)

Legacy BE order (Daily → Scheduled → Happy Hour) is retired.

## Status model

`active_now` | `scheduled` | `inactive` | `expired` | `outside_time` | `invalid`

Archived offers surface as `expired` and are hidden from POS enrichment.

## Persistence — trays

`order_items` snapshot columns (nullable, additive migration):

- `combo_id`
- `tray_locked`
- `offer_source_type`
- `offer_source_id`

On reopen, `orderItemsToCartLines` restores `trayLocked` / `comboId`. Children keep historical name/qty/price; never re-expand from live combo template.

Sale authority for trays remains the **header line price**; children use catalog prices for kitchen/validation.

## Permissions

| Surface | Rule |
|---------|------|
| Nav | admin/manager |
| UI | `isManager` gates mutate actions |
| IPC mutate | `requireOffersManager(__sufraActor)` |
| HTTP mutate | Bearer JWT role must be admin/manager (`extractActorFromAuthHeader`) |
| HTTP/IPC read | open to authenticated app clients |

Delete routes archive (soft) rather than hard delete.

## Admin UI

`OffersPage` → `OffersCenter` + `OfferSideDrawer`.

Actions: details, edit (typed forms), duplicate (inactive copy), activate/deactivate, archive (confirm).

Dead code removed: `OffersManagement.tsx`, `OffersTabs.tsx`, `OffersWindow.tsx`.

## POS

Single helper `buildOffersCategoryItems` shared by dine-in / pickup / delivery. Uses pricing resolver + scheduled combo override.

## Audit

Table `offer_audit_log`: event, offer_type, offer_id, user_id, username, before_json, after_json, created_at.

## Tests

`npm run test --prefix frontend` — Vitest domain suite (`offers-domain.test.ts`).

## Limitations

- Featured “archive” still primarily unfeature/delete semantics
- Daily deal full field edit remains limited where update API only toggles `is_active`
- No full E2E framework; domain unit tests only
- Older orders without tray snapshot columns reopen as unlocked manual trays (backward compatible)
