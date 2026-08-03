# Build & release (Windows)

## Version bump

1. `electron/package.json` → `version`
2. `docs/SYSTEM_CHANGELOG.md` → new section
3. `docs/README.md` → last review date

## Build installer

```bash
cd electron
npm run dist
```

Requires: frontend build, backend build, Visual Studio Build Tools (native modules).

## Update server

Publish `latest.yml` + installer to:

`https://bazarone.amaantechnology.com/updates/sufra_lite/`

Must match `electron/updater/resolve-update-feed-url.ts` and `electron/electron-builder.json`.

## Post-release

- Verify hub checks for updates (Settings → License & updates)
- Verify backup still runs and does not touch `license.json`
