# Onboarding & backup

## Roadmap phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Store setup wizard | Planned |
| 2 | Daily local backup (Electron hub) | **Shipped** |
| 3 | Custom folder, retention UI, disk warnings | Planned |
| 4 | Platform activation requests | Planned |
| 5 | Cloud backup | Long term |

## User entry point

**Settings → Backup** (`SettingsBackupPage` / `SettingsBackupCard`)

| Control | Purpose |
|---------|---------|
| Enable scheduled backup | Daily automatic snapshots (default: on) |
| Schedule time | Default **02:00** local time |
| Back up now | Manual snapshot |
| Status panel | Last run, next run, size, last error |
| Restore | **Admin only** — confirm, then app restarts |

LAN browser clients see “Electron hub only”.

## Backup location

```
{userData}/sufra-lite/backups/backup-YYYY-MM-DD_HHmmss/
├── sufra.sqlite
├── recipe-print-branding.json
├── uploads/
└── manifest.json
```

Settings file (not snapshotted): `{userData}/backup-settings.json`

## Protected files (never backed up, never restored)

These files keep **license validation**, **platform sync**, and **electron-updater** working:

| File / folder | Why excluded |
|---------------|--------------|
| `license.json` | Machine-bound license |
| `license-rolling-sync-cache.json` | Offline sync deadline |
| `license-platform-grant-cache.json` | Platform grant cache |
| `platform-license-url.txt` | License server URL override |
| `backup-settings.json` | Backup scheduler state |
| `backups/` | Snapshot storage |
| `logs/` | Runtime logs |
| `pending/`, `pending-update*` | Update download state |
| Electron cache dirs | Browser/updater caches |

The manifest records `protectedFilesExcluded` so support knows license/update files were intentionally skipped.

## Backup flow

1. `withBackupLockAsync` — no overlapping backup/restore
2. `PRAGMA wal_checkpoint(TRUNCATE)` on live DB
3. Copy POS assets only (`sufra.sqlite`, branding JSON, `uploads/`)
4. Write `manifest.json`
5. Prune — keep **7** newest (configurable `retentionCount`, max 30)
6. Update `backup-settings.json`

On failure: remove partial folder, store error in settings.

## Restore flow (admin, destructive for POS data only)

1. UI sends `backupId` + JWT via `window.sufra.backup.restore`
2. Main validates admin via `/api/auth/me` role check
3. `shutdownBackend()` — closes SQLite cleanly
4. Rename live POS files → `.pre-restore-{stamp}-*`
5. Copy backup files into live locations (**protected files untouched**)
6. `app.relaunch()` + exit

## Architecture

```
SettingsBackupCard (frontend)
    ↓ window.sufra.backup.* IPC
preload.ts
    ↓
electron/backup/
    ├── run-backup.ts
    ├── restore-backup.ts
    ├── backup-scheduler.ts
    ├── prune-old-backups.ts
    ├── backup-settings-store.ts
    ├── backup-paths.ts          ← protected file list
    └── register-backup-ipc.ts
```

Types: `electron/shared/types/backup.ts`

## Update feed (unchanged by backup)

Auto-update uses `electron-updater` with feed URL from `electron/updater/resolve-update-feed-url.ts` (`latest.yml` on the Aman platform). Backup/restore does **not** modify this code path or updater cache files.
