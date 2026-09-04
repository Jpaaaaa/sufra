# Core concept

**Sufra Lite POS** is a restaurant point-of-sale system for Windows hubs with LAN-connected clients.

## Principles

- **Hub owns data** — SQLite and backups live on the Electron machine
- **Offline-capable** — LAN clients work without internet; license has offline grace
- **Updates are independent** — `electron-updater` and license files must survive backup/restore
- **Same PR, same docs** — ship features with updated `docs/`
