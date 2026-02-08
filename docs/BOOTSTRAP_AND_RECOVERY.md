# Bootstrap And Recovery

## Startup Contract

Hub startup is fully gated by a reducer-backed state machine:

- `idle`
- `booting`
- `ready`
- `failed`

The functional UI is not rendered unless state is `ready`.

## Bootstrap Pipeline

`BootstrapService` runs ordered, timeout-protected steps:

1. Check runtime bridge (`tauri` or dev `mock`).
2. Load local state (`platform`, registry, settings).
3. Load catalog (API, then offline fallback).
4. Load release manifests (API, then per-product fallback).
5. Hydrate store and mark runtime `ready`.

During `booting`, a full-page loading view shows current step text.

## Failure Handling

Failures render a full-page blocking state with:

- short user-facing message
- machine-readable code
- technical details disclosure
- recovery hints
- retry action

In browser dev (`TAURI_UNAVAILABLE`), the failure screen also includes:

- `Enable Mock Mode (dev)` as primary CTA
- `How to run` command guidance

`Retry bootstrap` always goes through one reset path:

- clear bootstrap state to `idle`
- clear bootstrap status message/runtime error
- re-run full bootstrap pipeline

## Log Location Behavior

`src/services/platform/paths.ts` returns platform-aware log paths:

- macOS: `~/Library/Application Support/com.Antiphon.Hub/logs`
- Windows: `%APPDATA%\com.Antiphon.Hub\logs`
- Linux: `~/.local/share/com.Antiphon.Hub/logs`

In browser mode, `Open logs` does not throw. It explains native logs are unavailable and shows the path hint.

## Support Bundle

`Export support bundle` outputs JSON with:

- app version
- runtime diagnostics (`mockMode`, `platformDetected`, user agent/platform)
- sanitized settings
- bootstrap error payload (if present)
- in-memory log ring buffer
- platform-aware log path hint

## Dev Run Modes

Browser-only dev (UI validation):

```bash
pnpm dev:server
pnpm dev
```

Desktop dev (full desktop bridge):

```bash
pnpm dev:server
pnpm --filter @antiphon/hub tauri:dev
```
