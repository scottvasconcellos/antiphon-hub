# Design System

## Visual Intent

Calm, competent, exact. Grayscale-led UI with contrast as accent. No playful styling and no decorative noise.

## Color Tokens

- Absolute Black: `#000000` (primary background)
- Carbon: `#1A1A1A` (elevated surfaces)
- Graphite: `#333333` (components)
- Steel: `#666666` (dividers)
- Mist: `#B3B3B3` (secondary text)
- Pure White: `#FFFFFF` (primary text and CTA contrast)

## Typography

- Typeface: Inter
- Sentence case only
- Large headings with slight negative tracking (machined feel)
- Hierarchy by spacing/weight/size, not decoration

## Shared UI Package

`packages/ui` exports:

- `Button`
- `Card`
- `Input`
- `Chip`
- `Modal`
- `Sidebar`
- `Table`
- `Progress`
- `ErrorBanner`

All components map to the same tokenized grayscale CSS (`packages/ui/src/styles.css`).

## Error Surfaces

No raw browser alerts.

- Inline error banner in context
- Optional details block
- Error code visibility for support/debugging
