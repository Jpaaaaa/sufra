# Offers V2 Plan — Architecture Audit & Implementation

Branch: `feat/combo-fixed-trays`  
Status: **Implemented** (see also [`docs/offers-v2-architecture.md`](./offers-v2-architecture.md))

---

## 1. Current Architecture (pre-V2 audit)

- **Frontend:** React 18 + Vite + Tailwind + i18next. Route `/offers` → `OffersPage` → monolithic `OffersManagement.tsx` (~1172 lines).
- **Electron:** Preload attaches `__sufraActor` on IPC; offers handlers ignore role.
- **Backend:** `OffersService` CRUD for five offer types; Fastify dual paths (`/offers/*` GET + `/api/offers/*` CRUD).
- **POS:** Combos become locked trays in cart via `buildLockedComboTrayCartItem`; product offers enriched in `offer-pricing.ts`.

## 2–14. Audit findings

Documented in the original plan brief. Key gaps: FE/BE pricing mismatch, tray lock lost on reopen, UI-only RBAC, no archive/audit, god-component UI, no domain tests.

## Locked decisions (shipped)

- Separate tables + unified `OfferViewModel`
- Priority: Daily → Happy Hour → Scheduled → catalog
- Combo = locked tray; scheduled combo fully supported
- Archive via `archived_at`; soft-delete primary
- Snapshot columns on `order_items`
- Vitest for domain only

## Implementation completion notes

| Phase | Result |
|-------|--------|
| 0 | This plan doc |
| 1 | `electron/shared/offers/*` + FE `@sufra-offers` |
| 2 | Safe ALTERs: `archived_at`, tray snapshot cols, `offer_audit_log` |
| 3 | Validation, archive/duplicate, audit, IPC + HTTP RBAC, unified pricing |
| 4 | Persist/reopen `combo_id`/`tray_locked`; scheduled combo POS price |
| 5–8 | `OffersCenter` + `OfferSideDrawer`; i18n ar/en/ckb; dead UI removed |
| 9 | `buildOffersCategoryItems` shared across order channels |
| 10 | Vitest domain suite + frontend build/lint |
| 11 | `offers-v2-architecture.md` + this completion note |

Supersedes operational sections of [`OFFERS_PAGE.md`](./OFFERS_PAGE.md) — keep that file for Arabic product narrative; prefer V2 architecture for pricing/permissions/POS facts.
