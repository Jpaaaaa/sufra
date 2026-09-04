# Cursor Agent Task — Sufra POS: Waiter Handheld Interface (`/pos`)

## 0. Mission

Build a **new, touch-first `/pos` route tree** in `frontend/` for the **waiter** role, targeting **landscape phones and landscape tablets**. It reuses the existing data hooks and API layer — it does **not** reuse the existing desktop presentation components.

The existing `/orders` page is a desktop layout that was squeezed onto tablets with `!important` CSS overrides (`font-size: 11px`, `button { padding: 3px 6px }`). Do **not** try to fix that by making it more responsive. Build the waiter experience separately and leave `/orders` alone.

**Waiter scope (in this task):** open a table, add/edit items, send to kitchen, print, move tables, apply discounts.
**Explicitly out of scope:** taking payment, closing/settling orders, the delivery-driver flow, reports, finance, settings.

---

## 1. Non-negotiable constraints

These are properties of this codebase that you will get wrong if you assume defaults.

1. **Tailwind transition and animation utilities are DISABLED.** See `frontend/tailwind.config.ts`:
   ```ts
   corePlugins: {
     transitionProperty: false, transitionDuration: false,
     transitionDelay: false, transitionTimingFunction: false, animation: false,
   }
   ```
   `transition-*`, `duration-*`, `animate-*` classes **do not exist**. `.animate-spin` works only because it is hand-written in `frontend/src/globals.css:329`. Any motion you need must be written as plain CSS in a stylesheet, not as a utility class. Keep motion minimal — these are low-end Android devices.

2. **Router is `HashRouter`.** Routes resolve as `#/pos/floor`. Do not introduce `BrowserRouter` or absolute-path assumptions.

3. **The app is RTL** (Arabic default, also `ckb`; `en` is LTR). In all new `/pos` code use **CSS logical properties** — `ms-*`/`me-*`, `ps-*`/`pe-*`, `start-*`/`end-*`, `border-s`/`border-e`. Never `ml-*`/`mr-*`/`left-*`/`right-*`. The existing order components get this wrong; do not copy that pattern.

4. **Three locale files must stay in sync:** `frontend/src/locales/ar.json`, `ckb.json`, `en.json`. Every new string gets a key in **all three**. No hardcoded Arabic string literals in `/pos` components. (`useOrdersPage.ts` has hardcoded Arabic toasts — do not imitate it.)

5. **Zustand stores live at `frontend/stores/`**, i.e. `import { useHallStore } from '../../../stores/hallStore'` from inside `src/pages/`. Not under `src/`.

6. **`borderRadius` tokens `soft`, `soft-lg`, `soft-xl` are all 12px.** They are aliases, not a scale.

7. **No `!important` anywhere in new code.** If you feel you need it, the component structure is wrong.

8. **Do not modify** anything under `electron/`, `license-manager/`, `shared/`, `frontend/src/license/`, `frontend/src/pages/orders/`, or `frontend/src/components/orders/`. Read them freely; change none of them. Changes to shared hooks must be **purely additive** (new optional params / new returned fields) and must not alter existing return shapes.

---

## 2. What already exists — reuse this, do not rebuild it

| Need | Use this | Location |
|---|---|---|
| Halls, floors, tables + live status | `useOrders()` → `{ halls, floors, selectedHall, tables, loading, error, selectHall, loadTablesForHall }` | `src/hooks/useOrders.ts` |
| Full ordering logic for one table | `useOrderModal(table, hall)` | `src/hooks/useOrderModal.ts` |
| Live order events | `useOrderSocket()` → `subscribeToOrders(cb, ['dine-in'])` | `src/hooks/useOrderSocket.ts` |
| HTTP | `fetchJson`, `getServerUrl` | `src/utils/index.ts` |
| Types | `Hall`, `TableEntity` from `src/utils`; `CartItem`, `ExistingOrder`, `Category` from `src/hooks/useOrderModalTypes.ts` | — |
| Toasts / confirms | `showToast`, `showConfirm` | `src/components/ui/Toast.tsx`, `ConfirmDialog.tsx` |
| Numeric entry | `NumericKeypad` | `src/components/ui/NumericKeypad.tsx` |
| Item option pricing | `src/lib/item-options.ts`, `src/hooks/cart-item-utils.ts` | — |
| Move-table API | `POST {serverUrl}/orders/dine-in/move-table` body `{ source_table_id, target_table_id }` → `{ movedCount }` | see `useOrdersPage.ts:70` |

**Important:** `useOrderModal(table, hall)` is already headless — it holds **no modal open/close state**. It is directly usable from a full-screen page. Do not fork it, do not wrap it in a modal.

`useOrdersPage()` is the opposite: it returns 60+ fields and is coupled to modal state and to the pickup/delivery tabs. **Do not use it in `/pos`.** Compose `useOrders()` + `useOrderSocket()` directly instead.

`useOrders()` already registers a `window` listener for the `refresh-tables` CustomEvent (`useOrders.ts:118`), so dispatching that event after a mutation refreshes the floor screen — you do not need to thread a refresh callback through.

### 2.1 Sharp edges in the shared hooks

Three real traps. Read this before writing Phase 3 or 4.

1. **`handleApplyDiscount()` takes no argument and closes over `tableDiscount` state.** (`useOrderModal.ts:308` → `orderHandlers.handleApplyDiscount(tableDiscount)`.) Calling `setTableDiscount(20); handleApplyDiscount();` in the same tick applies the **previous** value. Fix additively: change the hook's wrapper to `handleApplyDiscount(override?: number)` and pass `override ?? tableDiscount` through. Existing callers pass nothing and are unaffected.

2. **`handleSubmitOrder()` resolves to `void`.** It identifies the newly-created order internally and parks the id in `animatedOrderId` for 2000ms — too fragile to build undo on. Fix additively: return the created order id (`Promise<number | null>`). Existing callers ignore the return value, so nothing breaks. The undo action needs that id.

3. **Discounts are table-level, not order-level.** `handleSubmitOrder` applies them via `PATCH /orders/table/:tableId/global-discount`. Present the discount as applying to the whole table in the UI — do not imply it is per-order.

Also be aware: the shared handlers fire their own `showToast` calls with hardcoded Arabic strings. That is pre-existing debt and **out of scope — do not fix it**, but do not add a second toast of your own on top of them.

### 2.2 What you need to write yourself

**Elapsed time.** `src/utils/format-time.ts` only exports `formatClockTimeAmPm` and `formatDateTimeAmPm` — clock and datetime formatters, no duration helper. Write a new `formatElapsedShort(since: string): string` in `src/pages/pos/` returning compact, localized durations (`٥د`, `١:٢٠`). Do not modify `format-time.ts`.

---

## 3. Design system (`/pos` scope only)

Create `frontend/src/pages/pos/pos.css`, imported once by the POS shell. All tokens scoped under `[data-pos]` so nothing leaks into the desktop app.

```css
[data-pos] {
  --pos-touch-min: 48px;      /* every interactive element, no exceptions */
  --pos-touch-primary: 56px;  /* primary actions */
  --pos-rail-w: 88px;
  --pos-cart-w: 320px;
  --pos-topbar-h: 44px;
  --pos-gap: 8px;
  --pos-radius: 12px;
  --pos-font-base: 16px;
  --pos-font-min: 13px;       /* nothing smaller, ever */
}
```

**Rules:**
- Minimum interactive size **48×48 CSS px**. Primary actions 56px tall.
- Minimum font size **13px**. Base 16px. The `11px` in the existing tablet CSS is the bug we are fixing — never reproduce it.
- Use existing palette tokens: `cyber-aqua` `#2EE7C9`, `charcoal-graphite` `#1A1F25`, `cloud-soft-white` `#F4F6FA`, `obsidian` `#121212`, `graphite` `#4A5668`.
- Status colors — **use consistently across both screens**:
  - **Free** → `stone-200` border, white fill, muted text
  - **Pending** (ordered, not yet sent to kitchen) → `amber-500`
  - **Printed** (sent to kitchen) → `emerald-500`
  - **Stale** (occupied > 45 min) → `red-500` indicator dot on top of the base status
- Layout must fit `100dvh` with `env(safe-area-inset-*)` respected — Android landscape has gesture insets on the side edges.
- `tabular-nums` on every number (prices, table numbers, times).

---

## 4. Screen specifications

Target viewports: **1204×555** (landscape phone, the worst case — design to this) and **1280×800** (landscape tablet).

### 4.1 POS shell — `PosLayout`

Full-bleed. **No `Header`, no `BottomNav`, no `Footer`, no `TabletZoomControls`, no `LayoutWrapper`.** Those are desktop chrome and they are what consumed 56% of the screen.

```
┌─ 44px topbar ────────────────────────────────────────────────┐
├──────────┬───────────────────────────────────────────────────┤
│  rail    │                                                   │
│  88px    │                  content (flex-1)                 │
│          │                                                   │
└──────────┴───────────────────────────────────────────────────┘
```
In RTL the rail sits on the **right** (it is first in DOM order; use logical properties and it lands correctly in both directions).

**Topbar (44px):** back/home button (48px) · current context title · connection indicator dot · user chip.
The connection dot reflects socket state + `navigator.onLine`: green connected, amber reconnecting, red offline.

### 4.2 Floor screen — `/pos/floor`

**Rail (88px, vertical scroll):** floor filter chips at the top (32px tall, horizontal, only rendered when `floors.length > 1`), then hall buttons below — each 88×72px: hall number at 20px bold, name at 13px truncated, plus status dots (amber = has pending, emerald = has printed).

**Content:** tables grid only.
```css
grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
gap: var(--pos-gap);
```
Card height **96px**. `content-visibility: auto` for scroll performance.

**Table card — delete the SVG table illustration entirely.** It occupies ~60% of the current card and carries no information. Replace with:
- A 4px status strip on the **inline-start** edge, colored per the status scale
- Table number, 24px bold, tabular-nums
- Occupied only: elapsed time since oldest open order + item count, 13px
- Occupied only: total, 15px semibold, tabular-nums
- Free: number only, muted — negative space is the signal

**Acceptance:** at 1204×555, **at least 20 table cards must be visible without scrolling.** The current page shows about 4 partial cards.

Halls and tables are visible **simultaneously**. Selecting a hall never navigates away.

### 4.3 Order screen — `/pos/table/:hallId/:tableId`

A **route, not a modal**. Three columns:

```
┌─ 44px topbar: [←] table name · existing-orders chip · total ──┐
├────────┬──────────────────────────────────┬───────────────────┤
│ categs │        items grid                │      cart         │
│  88px  │        (flex-1)                  │      320px        │
└────────┴──────────────────────────────────┴───────────────────┘
```

**Category rail (88px, vertical):** replaces the current horizontal `CategoryTabs` scroller. Vertical reclaims ~60px of height and is far easier to scan than a horizontal scroller. Each entry 88×64px. Keep the existing special categories — offers (`OFFERS_CATEGORY_ID = -1`, amber) and shelves (`SHELF_CATEGORY_ID = -2`, emerald) — with their current color coding.

**Items grid:** `repeat(auto-fill, minmax(120px, 1fr))`, card 88px tall. Item name up to 2 lines at 13px, price 15px bold, small kitchen-color dot. Tap adds directly to cart; if `item.has_options` is true, open the options sheet instead. Search input lives in the topbar of this screen (there is horizontal room — do not give it its own row).

**Cart (320px):**
- Header: existing orders for this table, collapsed by default, expandable
- Line list, scrollable, each line **min 56px**: name, quantity stepper (two 44px buttons with the count between them), line price
- Footer, pinned: subtotal · discount button · **total at 22px bold** · primary action `إرسال للمطبخ` full-width at 56px

---

## 5. Touch interactions

### 5.1 Move table — replace HTML5 drag entirely

`TablesGrid.tsx` currently uses `draggable` + `dataTransfer`. **HTML5 drag-and-drop does not fire on Android WebView / Capacitor.** The feature is dead on the waiter's device today.

Implement **tap-select-tap** instead:

1. Long-press (500ms) an occupied table → action sheet opens
2. Sheet action `نقل الطاولة` puts the floor screen into **move mode**
3. Move mode: a banner at the top (`اختر الطاولة الهدف`) with a cancel button; every other table gets a highlight ring; the source table is visibly marked
4. Tapping a target opens the existing `ConfirmMoveDialog`
5. Confirm → `POST /orders/dine-in/move-table` → toast → refresh via the existing `refresh-tables` CustomEvent + `loadTablesForHall`

Move mode must be cancellable with the topbar back button and with the banner's cancel button.

### 5.2 Action sheet

A **side sheet from the inline-start edge, 320px wide, full height** — not a bottom sheet. At 555px viewport height a bottom sheet has no room.

Actions for an occupied table: `نقل الطاولة` · `طباعة` · `خصم` · `إلغاء الطلب`. Each row 56px tall.

### 5.3 Discount

Replace the slider pattern (`TableDiscountSlider.tsx` is 15KB and imprecise with a thumb) with a side sheet containing preset percentage chips **5 / 10 / 15 / 20 / 25**, each 56px tall, plus an "amount" toggle that reveals the existing `NumericKeypad`.

Wire to `handleApplyDiscount` — but see §2.1 trap 1 first. Pass the value explicitly via the new override parameter; do not rely on `setTableDiscount` having flushed.

### 5.4 Item options

Side sheet from the inline-start edge, **420px**, full height. Option groups as 56px rows. Confirm button pinned at the bottom. Respect the three existing pricing modes (`replace` / `inherit` / `add`) — reuse the logic in `src/lib/item-options.ts`, do not reimplement pricing.

### 5.5 Send to kitchen — undo, not confirm

**No confirmation dialog.** A confirm costs one tap on every single order, all shift.

Submit immediately via `handleSubmitOrder`, then show a toast for 3 seconds with a `تراجع` action that calls `handleCancelOrder(orderId)` for the order just created. This requires the additive return-value change described in §2.1 trap 2 — `handleSubmitOrder` currently resolves to `void`.

Do **not** implement undo by delaying the POST. If the app is backgrounded or killed in those 3 seconds, the order silently never reaches the kitchen.

---

## 6. Realtime and concurrency

Two waiters opening the same table is the real failure mode here. Last-write-wins is not acceptable.

- **Floor screen:** `subscribeToOrders(cb, ['dine-in'])`; refresh table statuses on events. No polling.
- **Order screen:** if an event arrives for the currently open table from another device:
  - cart is empty → refresh silently
  - cart has unsent lines → show a **non-blocking banner** (`تم تحديث هذه الطاولة من جهاز آخر`) with a reload action. **Never auto-clear a waiter's in-progress cart.**
- **Offline:** when the socket is disconnected or `navigator.onLine` is false, show the red dot in the topbar and disable the submit button with an explicit message. Failing silently is worse than blocking.
- Adding to the cart is local state and must stay instant — never await the network on a tap.

---

## 7. Routing and role guard

1. Create `frontend/src/components/auth/RequireRole.tsx`:
   ```tsx
   <RequireRole allow={['waiter', 'cashier', 'manager', 'admin']}>…</RequireRole>
   ```
   Reads `useAuth()`; redirects to `/login` when unauthenticated and to `/` when the role is not allowed. Compose it *inside* the existing `ProtectedRoute` — do not replace `ProtectedRoute`.

2. In `App.tsx`, add the `/pos` routes **outside** `LayoutWrapper` (they must not inherit desktop chrome) but **inside** `LicenseRouteGuard` and `ProtectedRoute`:
   ```tsx
   <Route element={<ProtectedRoute><RequireRole allow={[...]}><PosLayout /></RequireRole></ProtectedRoute>}>
     <Route path="/pos" element={<Navigate to="/pos/floor" replace />} />
     <Route path="/pos/floor" element={<PosFloorPage />} />
     <Route path="/pos/table/:hallId/:tableId" element={<PosTablePage />} />
   </Route>
   ```
   Lazy-load both pages, consistent with every other route in the file.

3. `LoginPage`: after successful auth, redirect `role === 'waiter'` to `/pos/floor`. All other roles keep their current destination.

4. Add `nav.pos` keys to all three locale files and a `/pos` entry in `navConfig.ts` for `admin`/`manager` so they can reach it for testing.

---

## 8. Orientation

Design and verify in **landscape**. Add a minimal `@media (orientation: portrait)` fallback: rail collapses to a 44px horizontal chip strip, cart becomes a bottom sheet toggled by the total bar. **Do not ship a blocking "please rotate your device" overlay** — it is hostile when someone glances at the screen one-handed.

---

## 9. File manifest

Create exactly these. Do not scatter POS code into the existing folders.

```
frontend/src/pages/pos/
  PosLayout.tsx              # shell: topbar + rail slot + <Outlet/>, data-pos root
  pos.css                    # tokens + POS-only CSS (no !important)
  PosFloorPage.tsx
  PosTablePage.tsx
  usePosFloor.ts             # composes useOrders + useOrderSocket + move mode
  usePosTableOrder.ts        # thin wrapper over useOrderModal + undo/conflict state
  format-elapsed.ts          # formatElapsedShort() — see §2.2
  components/
    PosTopBar.tsx
    PosHallRail.tsx
    PosTableCard.tsx
    PosCategoryRail.tsx
    PosItemGrid.tsx
    PosItemCard.tsx
    PosCart.tsx
    PosCartLine.tsx
    PosSideSheet.tsx         # generic start-edge sheet, used by all sheets below
    PosTableActionSheet.tsx
    PosDiscountSheet.tsx
    PosOptionsSheet.tsx
    PosMoveBanner.tsx
    PosConnectionDot.tsx
frontend/src/components/auth/RequireRole.tsx
```

Plus exactly two **additive** edits to shared files, per §2.1: an optional `override` parameter on `handleApplyDiscount`, and a return value on `handleSubmitOrder`. Nothing else outside `src/pages/pos/` changes except `App.tsx` (routes), `LoginPage` (redirect), `navConfig.ts` (entry), and the three locale files.

---

## 10. Phasing — stop and report after each phase

Work in this order. After each phase, run `npx tsc --noEmit` and `npm run build`, then summarize what changed before continuing.

- **Phase 1** — `pos.css` tokens, `PosLayout`, `PosTopBar`, `RequireRole`, routes in `App.tsx`, locale keys. Renders an empty shell at `#/pos/floor`.
- **Phase 2** — `PosFloorPage`, `PosHallRail`, `PosTableCard`, `usePosFloor`. Halls + tables live, tap-through to a stub order route.
- **Phase 3** — `PosTablePage`, category rail, item grid, cart, submit. Full ordering path works end to end.
- **Phase 4** — `PosSideSheet` + action sheet, move mode, discount sheet, options sheet, undo toast.
- **Phase 5** — socket wiring, conflict banner, offline handling, portrait fallback.
- **Phase 6 — DO NOT START WITHOUT EXPLICIT APPROVAL.** Cleanup: delete from `globals.css` the two tablet media blocks (`@media (min-width: 768px) and (max-width: 1279px) …`, both aspect-ratio variants) and the `html.tablet-viewport.tablet-portrait` block; remove the `tablet-viewport` / `tablet-portrait` class effect from `App.tsx`. These exist only to shrink desktop layouts onto tablets and become dead once `/pos` is the waiter's entry point — but they must not be removed until `/pos` is confirmed in real use.

---

## 11. Acceptance criteria

Verify each of these before declaring done. Report the result of each explicitly.

- [ ] `npx tsc --noEmit` clean; `npm run build` succeeds
- [ ] At **1204×555**, the floor screen shows **≥20 table cards without scrolling**
- [ ] Every interactive element in `/pos` is **≥48×48 CSS px** — audit by measuring, not by eye
- [ ] No computed `font-size` below **13px** anywhere in `/pos`
- [ ] **Zero** occurrences of `!important` in new files
- [ ] **Zero** HTML5 drag attributes/handlers (`draggable`, `onDragStart`, `dataTransfer`) in `/pos`
- [ ] **Zero** hardcoded Arabic string literals in `/pos` components; every key present in `ar.json`, `ckb.json`, **and** `en.json`
- [ ] No physical-direction utilities (`ml-`, `mr-`, `left-`, `right-`) in `/pos` — logical properties only. Verify the layout mirrors correctly by switching the language to `en`
- [ ] `/orders` and every other existing route render **exactly as before** — diff the untouched files to confirm
- [ ] The two additive hook changes (§2.1) break no existing caller: `handleApplyDiscount()` with no argument and `handleSubmitOrder()` with its return value ignored both still behave identically in `/orders`
- [ ] Discount applied from `/pos` produces the same result as the same discount applied from `/orders` on the same table
- [ ] Full path works on a real Android landscape device: login as waiter → floor → table → add item with options → discount → send → undo → move table

---

## 12. Rules of engagement

- Ask before adding **any** npm dependency. The likely-correct answer is that none is needed.
- Do not introduce a state-management library for `/pos`. Local state + the existing hooks + the existing Zustand stores are sufficient.
- Do not refactor existing files "while you're in there." Additive changes only, in the files named in §7.
- Prefer deleting a decorative element over shrinking it. Vertical space is the scarce resource on this screen; ornament is what we are removing.
- If a spec here conflicts with something you find in the codebase, **stop and say so** rather than silently picking one.
