# Antiphon App Template

Production foundation for the Antiphon Studios desktop Hub:

- Tauri v2 + React + TypeScript + Vite
- Monorepo template for future Antiphon apps
- Signed catalog/release manifests
- Download, verification, install, uninstall, launch lifecycle
- Perpetual license + offline request/response flow

## Workspace Layout

- `apps/hub`: Desktop Hub (Tauri + React)
- `apps/mock-server`: Local contract server (`/catalog`, `/releases/:productId`, `/activate`, `/account/products`)
- `packages/core`: Domain types, schemas, verification, state transitions
- `packages/api`: Typed API client contracts
- `packages/motion`: Framer Motion presets and timing/easing constants
- `packages/ui`: Shared UI components + CSS tokens
- `data/manifests`: Signed catalog/releases and local dummy artifacts
- `docs`: Architecture, design, motion, licensing, security, release pipeline

## How To Run

1. `pnpm install`
2. `pnpm dev:server` (mock API on `http://localhost:5174`)
3. `pnpm dev` (Hub web shell on `http://localhost:5173`)
4. Desktop runtime: `pnpm --filter @antiphon/hub tauri:dev`

Build Hub frontend:

- `pnpm build`

Build all packages/apps:

- `pnpm build:all`

Run tests:

- `pnpm test`

Run dummy product smoke install (manifest + signature + hash + extraction):

- `pnpm smoke:e2e`

## Mock To Real Backend Replacement

Update these integration points:

- `apps/hub/src/lib/api.ts`: change `baseUrl` to production API
- `apps/mock-server/src/index.ts`: replace mock activation/account logic with real services
- `data/manifests/*`: generated dev manifests; replace with CI-signed release artifacts
- `apps/hub/src/state/hub-store.ts`: remove offline JSON fallback (`src/data/offline-*.json`) when production catalog is guaranteed

## Current Strategy Coverage

Implemented now:

- Portable zip install strategy (`portableZip`) with full verify/install/uninstall flow
- Signed manifest + artifact verification (Ed25519 + SHA-256)
- Keychain-secured token storage
- SQLite installed-product registry + settings

Defined placeholders (intended next increment):

- `macAppCopy` (`dmg`/`zip` to `/Applications`)
- `macPkg`
- `windowsInstaller` (`exe` / `msi`)

## Branding + Motion

Implementation follows local source docs provided in this workspace:

- Brand system (`Antiphon_Studios_Brand_Guide.pdf`)
- Animation presets (`Antiphon Studios Animation & Interaction Preset System.docx`)
- Hub rewrite plan (`Plan for Rewriting the App Suite with a Unified Hub.docx`)
