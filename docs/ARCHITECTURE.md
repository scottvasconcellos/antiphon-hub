# Architecture

## Goal

A low-overhead, cross-platform desktop Hub for catalog, downloads/installs, updates, licensing, activation, and app launching. Functional products remain standalone apps.

## Stack

- Desktop runtime: Tauri v2 (Rust backend)
- UI: React + TypeScript + Vite
- Motion: Framer Motion only for non-trivial choreography
- Shared domain: workspace packages (`core`, `api`, `motion`, `ui`)
- Local durability: SQLite registry
- Secure secrets: OS keychain via Rust `keyring`

## Runtime Modules

- `apps/hub/src`: UI shell, navigation, state, typed API usage, Framer transitions
- `apps/hub/src-tauri/src/lib.rs`: command backend
- `apps/mock-server`: local contract server and signed mock activation

## Data Flow

1. Hub boots with `get_hub_state` (registry + settings) from SQLite.
2. Hub fetches `/catalog` + `/releases/:productId` from API; falls back to local offline JSON.
3. On install/update:
   - select artifact by OS/arch
   - download
   - verify manifest signature
   - verify artifact signature
   - verify artifact SHA-256
   - run install strategy
   - verify installed path exists
   - write registry record
4. On launch/uninstall: route through Tauri commands against registry records.

## Security Boundary

- Frontend never handles private signing keys.
- Public key only is used for verification.
- Secret tokens/credentials are keychain-backed.
- License files are signed payloads written to shared product-readable locations.

## Persistence

SQLite tables in Hub data directory:

- `installed_products`: install version/path/health metadata
- `settings`: serialized hub settings

## Events

`download-progress` events are emitted from Rust and consumed by Zustand state for queue/progress UI.
