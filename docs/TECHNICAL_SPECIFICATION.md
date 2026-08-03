# Technical specification

## Stack

| Layer | Technology |
|-------|------------|
| Desktop | Electron 30, TypeScript |
| UI | React, Vite, Tailwind |
| API | Fastify + Socket.IO (LAN port **3333**) |
| Database | SQLite (`better-sqlite3`) — `sufra.sqlite` in `userData` |
| Updates | `electron-updater`, generic feed |

## Data paths (production)

| Asset | Path |
|-------|------|
| Database | `{userData}/sufra.sqlite` |
| Uploads | `{userData}/uploads/` |
| Recipe print branding | `{userData}/recipe-print-branding.json` |
| License | `{userData}/license.json` |
| Platform sync caches | `{userData}/license-*.json` |
| Backups | `{userData}/sufra-lite/backups/` |
| Backup settings | `{userData}/backup-settings.json` |

## Auto-update feed

- URL: `https://bazarone.amaantechnology.com/updates/sufra_lite/`
- Config: `electron/updater/resolve-update-feed-url.ts`, `electron/electron-builder.json`
- IPC: `window.amaan.update*` (preload)

Backup/restore **must not** copy or overwrite license/update paths (see `electron/backup/backup-paths.ts`).

## IPC surfaces

- `window.sufra.*` — POS data, print, backup
- `window.amaan.*` — license, updates, API port

## Item options (modifiers)

Per-menu-item option groups with three pricing modes:

| `pricing_mode` | Behavior |
|----------------|----------|
| `replace` | Option price replaces base (e.g. sizes S/M/L) |
| `inherit` | Option at base price (e.g. flavors) |
| `add` | Option price added to base (paid extras) |

### Schema

```sql
item_option_groups (
  id, item_id, name, pricing_mode, min_select, max_select, sort_order
)
item_options (
  id, group_id, name, price, is_default, is_out_of_stock, sort_order
)
items.has_options INTEGER  -- denormalized flag
order_items.options_json TEXT  -- snapshot at order time
```

`options_json` snapshot shape (shared type `OrderItemOptionSnapshot`):

```typescript
{
  group_id, group_name, option_id, option_name,
  pricing_mode: 'replace' | 'inherit' | 'add',
  price_effect: number
}
```

### API / IPC

- `GET /items` and `GET /items/:id` — items include embedded `option_groups` when present
- `POST /items`, `PUT /items/:id` — optional `option_groups` in body (replace-all save)
- `POST /items/:id/copy-options-from/:sourceId` — copy groups from another item
- IPC: `items:copyOptionsFromItem(targetId, sourceId)`

### POS cart / orders

- Cart lines use `cartLineId`, `selectedOptions`, `linePrice`
- Order submit sends `item_name` (formatted), `price` (final unit), `options_json`
- Kitchen print renders option sub-lines from `options_json`

Shared helpers: `electron/shared/types/item-options.ts`, mirrored in `frontend/src/lib/item-options.ts`.

## Dev

```bash
npm run setup    # from repo root
npm run dev      # frontend + electron
```

See [متطلبات-التشغيل.md](./متطلبات-التشغيل.md) for full requirements.
