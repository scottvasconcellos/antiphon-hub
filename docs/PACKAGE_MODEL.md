# Package Model (Layer 3-4 Stub)

The Hub models distributable artifacts as installable packages so app and plugin support can share one contract later.

## Package Type

- `packageType: "app" | "plugin"`

## Plugin Format (plugin only)

- `pluginFormat: "vst3" | "au" | "aax"`

## Current Layer Scope

- Layer 3-4 only implements deterministic state and workflow skeleton correctness.
- Real plugin installation is **not** implemented in this stage.
- Installer interfaces remain stubbed for plugin packages; current executable behavior is app-only mock/dev scaffolding.
