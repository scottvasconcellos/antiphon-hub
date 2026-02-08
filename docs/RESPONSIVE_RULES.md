# Responsive Rules

## Targets

Hub layout is hardened for these widths:

- 1280
- 1024
- 768
- 480

No horizontal overflow is allowed at these breakpoints.

## Layout Behavior

- `>1024`: full toolbar controls.
- `<=1024`: filter chips collapse into `More filters…`.
- `<=768`: list view collapses from table to stacked cards.
- `<=480`: sidebar becomes a horizontal nav strip to preserve content width.

## Filter Accessibility (`<=1024`)

`More filters…` control must support:

- Tab focus
- Enter/Space open (native button behavior)
- Escape close and focus return to trigger
- keyboard focus trapped inside popover while open

## Overflow Hardening

- Core containers use `min-width: 0`.
- Search/select controls cap width at container bounds.
- Table cells and card text use `overflow-wrap: anywhere`.
- Long names/taglines/version strings must remain readable.

## Keyboard Baseline

- Visible `:focus-visible` outlines on buttons/inputs/selects/links.
- Logical tab order on failure screen, products controls, and settings controls.
