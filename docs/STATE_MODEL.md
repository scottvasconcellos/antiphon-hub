# State Model

## Catalog And Selection

Catalog and selection are reconciled from one source of truth:

- products loaded from bootstrap payload
- selection resolved by `reconcileSelectedProductId(products, preferredSelection)`
- visible products resolved from route + filter/search selectors
- selection constrained to the current visible list via `reconcileSelectionWithVisibleProducts(visibleIds)`

Rules:

- if catalog is empty, `selectedProductId` is cleared (`undefined`)
- if preferred selection exists in catalog, keep it
- otherwise fallback to first product id

UI behavior follows this model:

- `catalog.length === 0`: products view shows catalog-empty state and detail panel shows catalog-empty detail
- filtered results empty with non-empty catalog:
  - `selectedProductId` is cleared
  - products view shows filter-empty state
  - detail panel shows matching filter-empty state
- if visible results become non-empty again and current selection is absent, first visible product is auto-selected

## Serial Validation Scope

Serial format validation is intentionally local to licensing submit flow:

- validator: `src/services/licensing/serial.ts`
- consumed by: `LicensesView` submit/blur handlers

Validation does not run during bootstrap or hydration.

Store action `activateSerial` no longer performs serial-format pre-validation. It assumes UI-layer validation has already passed.

This prevents licensing validation codes from leaking into unrelated routes unless user explicitly initiates licensing actions.

## Default Products Filters

For deterministic startup at this stage:

- bootstrap hydration resets products navigation state to defaults:
  - `nav = products`
  - `filter = all`
  - `search = ""`
  - `sort = name`
- entering the Products route also resets these defaults
- persisted state intentionally excludes nav/filter/sort

This avoids hidden stale filters producing confusing empty views on launch.

## Mock Mode Action Policy

Mock mode keeps command-layer block guards and matching UI affordances:

- install/update/launch/uninstall commands remain blocked in platform layer
- product detail action buttons render with `disabled`
- blocked actions show explicit tooltip copy:
  - `Mock mode — installs are disabled (UI validation only).`
  - `Mock mode — system actions are disabled (UI validation only).`
- settings `Verify installed apps` remains a real button and returns safe mock toast/log feedback
