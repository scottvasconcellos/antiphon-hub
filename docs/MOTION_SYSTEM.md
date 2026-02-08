# Motion System

## Single Engine Rule

Framer Motion is the authoritative animation engine for meaningful transitions and interactions.

## Presets (`packages/motion`)

- `cardEntranceVariant`: top-left grow-in, weighted spring
- `modalVariant`: slower/heavier modal appearance
- `tooltipVariant`: quick fade/slide micro-motion
- `pageVariant`: weighted page transitions
- `staggerContainer` + `itemStagger`: restrained list/grid reveal
- `errorShake`: brief firm shake
- `successBounce`: subtle success bounce
- `buttonMotion`: hover raise + tactile press compression

## Timing Profile

- Small controls/tooltips: ~150-200ms
- Cards/medium modules: ~200-320ms
- Modals/pages: ~300-400ms

## Practical Rules

- Keep motion 2D and axis-logical
- Avoid gimmicks (spins, over-bounce, flashy transforms)
- Avoid conflicting CSS keyframe choreography
- Favor consistency over novelty
