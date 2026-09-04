# Cursor Agent Task — Sufra `/pos` Phase 7: Brand Identity, Item Images, Session

**Run this in Agent mode.** It edits files.

Prerequisite: Phases 1–5 of `docs/POS_WAITER_REDESIGN_PROMPT.md` are already implemented — `src/pages/pos/` exists with `PosLayout`, `PosTopBar`, `PosFloorPage`, `PosTablePage`, `pos.css`, and the component set. All constraints from that document still apply in full: **no `!important`, no Tailwind `transition-*`/`animate-*` utilities (disabled in `tailwind.config.ts`), logical properties only (`ms-`/`me-`/`inline-start`/`inline-end`), every new string keyed in all three locale files, minimum touch target 48×48, minimum font size 13px.**

The screen currently works but reads as a generic app, not as Sufra. This phase restores brand identity, shows food photos, makes the session legible, and fixes two layout defects visible on a 956×440 device.

---

## 0. Corrections — three claims that are wrong

Do not act on these. They came from a prior planning pass and are inaccurate.

1. **`getItemImageUrl` does not exist anywhere in this codebase.** Do not import it. The real pattern is inline at `src/components/orders/ItemSelector.tsx:344`:
   ```ts
   item.image_url.startsWith('/uploads/') ? `${getServerUrl()}${item.image_url}` : item.image_url
   ```
   You will extract this into a new POS-local helper (§2).

2. **`logout()` already navigates.** `AuthContext.tsx:257` sets `window.location.hash = '#/login'` internally. Do **not** add a `navigate('/login')` after calling it — that produces a double navigation. Just call `logout()`.

3. **`getEmployeeDisplayName()` will not fix the "shows `1`" problem on its own.** Read `src/lib/userDisplay.ts`: it only special-cases the literal username `admin`. For a waiter whose username is `1` it returns `1` unchanged. What makes the chip read as a person is **pairing the name with the role label** via `roleLabelAr(user.role)` — which returns `كابتن` / `Captain` for `waiter`. Both are required.

---

## 1. Brand identity in the topbar

Currently `PosTopBar.tsx` renders a `⌂` text glyph, a title, a connection dot, and a raw username. No logo, no brand color, no product name.

**Constraint: the topbar stays 44px.** Identity must cost near-zero height. Do not add a second row.

### 1.1 Sources — reuse, do not invent
- Logo path: `` const LOGO_SRC = `${import.meta.env.BASE_URL}logo/logo.png` `` — same as `SidebarBrand.tsx:5`
- Product name: `APP_BRAND_NAME` from `src/lib/brand.ts` (value: `'sufra pos'`)
- Alt text: existing key `layout.logoAlt` (present in all three locales)
- Restaurant name: `window.sufra?.recipePrint?.getSettings?.()` → `{ restaurantName }`, as in `SidebarBrand.tsx:87`

**Critical:** `window.sufra` is the **Electron preload IPC surface and does not exist on the waiter's device.** The waiter runs a LAN/Android client where `window.sufra` is `undefined`. Guard with optional chaining *and* try/catch, and fall back silently to `APP_BRAND_NAME`. Never let this throw or render an empty brand slot.

### 1.2 What to render
- Replace the `⌂` glyph with a real icon from **`lucide-react`** (already a dependency — see `SidebarSession.tsx:3`). Use `Home` on the order screen's back button; keep the 48×48 hit area.
- Add a **28–32px round logo mark** at the inline-start of the topbar, `object-contain`, inside a `rgb(46 231 201 / 0.15)` ring — the same treatment as `SidebarBrand`. On image error, hide the `<img>` (do not leave a broken-image box).
- Next to the mark, show the restaurant name when available, otherwise `APP_BRAND_NAME`, at 13px semibold, truncated, `max-inline-size: 140px`.
- **Floor screen:** logo mark + brand text.
  **Order screen:** logo mark only — that topbar needs its width for the table name and search.

### 1.3 Brand color, at zero height cost
In `pos.css`, on `.pos-topbar`:
- background `linear-gradient(to bottom, rgb(46 231 201 / 0.10), #ffffff)` instead of flat white
- a 2px top accent line in `--pos-aqua`, echoing the desktop `Header` accent

That plus the existing aqua active-states on halls, categories, and floor chips is enough. **Do not** add the dot-matrix pattern, the spotlight glow, or the rotating rings from the desktop `Header` — they are decorative and cost pixels we do not have.

Do not put the logo on table cards or item cards.

---

## 2. Food images on item cards

`PosItemCard.tsx` currently renders a kitchen dot, name, and price only. `Item.image_url?: string | null` exists on the type (`src/hooks/useItems.ts:31`) and is populated by the API.

### 2.1 New helper
Create `src/pages/pos/item-image.ts`:
```ts
export function posItemImageSrc(item: Item): string | null
```
Implements the `ItemSelector.tsx:344` rule: return `null` when `image_url` is empty, prefix with `getServerUrl()` when the path starts with `/uploads/`, otherwise return it as-is. Do not modify `ItemSelector.tsx`.

### 2.2 Card layout
Grow the item card from **88px to 96px** and give it a **44px image band at the top**, name below on one line, price at the bottom. At a 440px-tall viewport this still yields 4 full rows.

- Image present → `<img>` at `44px` tall, full card width, `object-fit: cover`, `loading="lazy"`, `decoding="async"`.
- Image absent → the same 44px band filled with the item's **first character** on a muted `rgb(46 231 201 / 0.10)` ground. This is a monogram, not a fake food photo — it keeps every row the same height, which matters far more than the band being empty. (If you prefer a ragged grid, say so rather than silently changing it.)
- `is_out_of_stock` → `filter: grayscale(1); opacity: .5`, card `disabled`, and a small badge using a new key `pos.outOfStock`. This field exists on `Item` and is currently ignored — a waiter tapping an unavailable item is a real failure.

Images only on the **order screen**. Table cards are furniture, not food — leave them text-only.

---

## 3. Employee identity and logout

### 3.1 Session chip
Replace the raw `{user?.username}` in `PosTopBar.tsx` with a session control:
- initial letter in a `rgb(46 231 201 / 0.20)` circle, 32px
- `getEmployeeDisplayName(user.username)` from `src/lib/userDisplay.ts`
- `roleLabelAr(user.role)` beneath it at 11px in aqua — this is what turns `1` into `1 · كابتن`

Follow `SidebarSession.tsx` for the visual pattern; do not import that component (it is desktop-sized and has no 48px targets).

### 3.2 Space is tight at 956×440
Do not stack name, role, and a logout button inline in a 44px bar. Instead:
- The chip collapses to **just the initial circle** below `1024px` viewport width.
- Tapping the chip opens a **`PosSessionSheet`** built on the existing `PosSideSheet`, containing: full display name, role label, app version via `resolveAppVersion()` from `src/lib/brand.ts`, and the logout button.

Create `src/pages/pos/components/PosSessionSheet.tsx`.

### 3.3 Logout
- Button 56px tall inside the sheet, `LogOut` icon from `lucide-react`, red treatment as in `SidebarSession`.
- Label: existing key `layout.logout` (present in all three locales — do not add a new one).
- **Confirm first.** Use `showConfirm` from `src/components/ui/ConfirmDialog`. A mistapped logout mid-shift loses the waiter's session and forces a re-login on the floor. This is the opposite of the send-to-kitchen rule — send is frequent so it gets undo instead of confirm; logout is rare and disruptive so it gets a confirm.
- On confirm, call `logout()` and nothing else. See §0.2.

---

## 4. Two layout defects visible on-device

Both are confirmed against `pos.css` and reproduce at 956×440.

### 4.1 Table cards balloon when a hall has few tables
`.pos-tables` uses `repeat(auto-fill, minmax(128px, 1fr))`. With 6 tables the `1fr` stretches each card to ~180px, producing six oversized cards and a large empty band beneath — visible in the current build.

Fix in `pos.css`:
```css
[data-pos] .pos-tables {
  grid-template-columns: repeat(auto-fill, minmax(128px, 168px));
  justify-content: start;
}
```
Apply the same cap to `.pos-items` (`minmax(112px, 156px)`). Cards must keep a consistent size regardless of how many exist.

### 4.2 Floor chips overflow the 88px rail
`.pos-floor-chips` is `display: flex; overflow-x: auto` inside an 88px-wide rail, while `.pos-floor-chip` has `min-width: 48px`. Two chips plus the gap exceed 88px, so the second chip is clipped behind the first — visible in the current build as a partially hidden chip beside `الكل`.

Fix:
```css
[data-pos] .pos-floor-chips {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  overflow: visible;
}
[data-pos] .pos-floor-chip { min-width: 0; }
```
Chips wrap into rows of two instead of scrolling horizontally. Horizontal scroll inside an 88px rail is undiscoverable on touch.

---

## 5. New i18n keys

Add to `ar.json`, `ckb.json`, **and** `en.json` under the existing `pos` block. Reuse `layout.logout`, `layout.logoAlt`, `layout.adminDisplayName`, and `layout.role.*` — they already exist in all three.

| Key | ar | ckb | en |
|---|---|---|---|
| `pos.session` | الجلسة | دانیشتن | Session |
| `pos.outOfStock` | غير متوفر | نەبوونی | Out of stock |
| `pos.logoutConfirm` | تسجيل الخروج من الجلسة؟ | دەرچوون لە دانیشتن؟ | Log out of this session? |
| `pos.version` | الإصدار | وەشان | Version |

Verify the three files stay structurally identical after your edit.

---

## 6. Files touched

Modify: `PosTopBar.tsx`, `PosItemCard.tsx`, `PosItemGrid.tsx` (only if the card signature changes), `pos.css`, the three locale files.
Create: `src/pages/pos/item-image.ts`, `src/pages/pos/components/PosSessionSheet.tsx`.

Do **not** touch `SidebarBrand.tsx`, `SidebarSession.tsx`, `ItemSelector.tsx`, `Header.tsx`, or anything under `pages/orders/` and `components/orders/`. Read them for reference only.

---

## 7. Acceptance criteria

Report the result of each.

- [ ] `npx tsc --noEmit` clean; `npm run build` succeeds
- [ ] Topbar is still exactly **44px** tall with logo, brand text, session chip, and connection dot all present
- [ ] With `window.sufra` undefined (plain browser at `localhost:3000`), the brand renders `sufra pos` and **nothing throws** — verify in the console
- [ ] Item cards show photos where `image_url` exists and a monogram where it does not; **all cards in a row are the same height**
- [ ] An `is_out_of_stock` item is visibly disabled and cannot be added to the cart
- [ ] Session chip shows name **and** role (a waiter with username `1` reads as `1 · كابتن`, not a bare `1`)
- [ ] Logout asks for confirmation, then returns to `#/login` — with no double navigation
- [ ] At **956×440** a hall with 6 tables shows six **168px-wide** cards aligned to the start edge, not stretched
- [ ] At **956×440** with 2 floors, both floor chips are fully visible in the rail with no horizontal scroll
- [ ] Every new interactive element is ≥48×48; no new font-size below 13px; no `!important`; no `ml-`/`mr-`/`left-`/`right-`
- [ ] Switch the language to `en` and confirm the topbar mirrors correctly in LTR
