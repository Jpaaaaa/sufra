# Documentation maintenance

## Philosophy

Documentation lives in `docs/` and is updated **in the same PR as code** — not as a follow-up.

## What to update when

| You change… | Update… |
|-------------|---------|
| User-facing feature or UX | `FEATURES.md`, `SYSTEM_CHANGELOG.md` |
| API, schema, ports, build | `TECHNICAL_SPECIFICATION.md`, `BUILD_RELEASE.md`, `SYSTEM_CHANGELOG.md` |
| Arabic ops / install requirements | `متطلبات-التشغيل.md` |
| Backup / onboarding phases | `ONBOARDING_AND_BACKUP.md`, `ROADMAP.md`, shipped items → `FEATURES.md` |
| Idea not yet built | `ROADMAP.md` only — **not** `FEATURES.md` |
| Confirmed bug | `CURRENT_ISSUES.md` + GitHub Issue |

## Changelog format

```markdown
## [0.1.18] — 2026-08-02

### Added
- …

### Changed
- …

### Fixed
- …
```

Use **Added / Changed / Fixed / Removed / Security**. Write for store owners and support, not only developers.

## Per-release checklist

1. Bump `electron/package.json` version
2. New `## [x.y.z]` section in `SYSTEM_CHANGELOG.md`
3. `FEATURES.md` reflects current behavior
4. `TECHNICAL_SPECIFICATION.md` — ports, env vars, update feed URL if changed
5. `docs/README.md` — “Last doc review” date
6. Publish per `BUILD_RELEASE.md`
