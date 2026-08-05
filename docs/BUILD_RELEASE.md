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

### Upgrading from 0.1.13 (Sufra Lite)

Use **0.1.21+** as the Live feed target. Those builds keep the previous install until the new files are copied, then clean legacy Lite folders. Do not rely on 0.1.19/0.1.20 for the first auto-update jump from 0.1.13.

## Post-release

- Verify hub checks for updates (Settings → License & updates)
- Verify backup still runs and does not touch `license.json`
