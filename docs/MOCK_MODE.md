# Mock Mode

## Purpose

Mock mode is a dev-only browser fallback for validating UI flow when Tauri desktop APIs are unavailable.

It is not a production runtime path.

## How It Is Enabled

- Available only in `import.meta.env.DEV`.
- Enabled from the bootstrap failure screen with `Enable Mock Mode (dev)`.
- Persisted in local storage (`antiphon:mock-mode`).

## What It Allows

- Bootstrap to complete in browser.
- Catalog/settings/licensing UI scaffolding to be exercised.
- Non-privileged commands to be served by local mock handlers.

## What It Blocks

System-changing actions are blocked by command-layer guardrails (`MOCK_MODE_BLOCKED`), including:

- install/update (`download_and_install`)
- uninstall (`uninstall_product`)
- launch (`launch_product`)
- verify installed apps (`verify_installed_apps`)

UI actions for those flows are disabled in mock mode with explicit messaging.

## User Messaging

- Header badge: `Running in mock mode - UI validation only. No real installs or system changes.`
- Settings and product detail panels show mock-mode notes.

## Diagnostics

Support bundle includes:

- `runtime.mockMode`
- `runtime.platformDetected`

Log buffer includes a `Mock mode enabled/disabled` line when toggled.
