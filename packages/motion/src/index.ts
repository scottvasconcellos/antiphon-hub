import type { TargetAndTransition, Variants } from 'framer-motion';

export const durations = {
  fast: 0.16,
  base: 0.25,
  card: 0.32,
  modal: 0.36,
  pageIn: 0.3,
  pageOut: 0.18,
} as const;

export const easings = {
  analogEaseOut: [0.23, 1, 0.32, 1] as [number, number, number, number],
  analogEaseInOut: [0.4, 0, 0.2, 1] as [number, number, number, number],
  analogSoft: [0.25, 0.6, 0.3, 1] as [number, number, number, number],
};

export const springs = {
  card: { type: 'spring', stiffness: 120, damping: 20, mass: 1.1 } as const,
  button: { type: 'spring', stiffness: 500, damping: 30, mass: 0.6 } as const,
  soft: { type: 'spring', stiffness: 100, damping: 20, mass: 0.9 } as const,
};

export const cardEntranceVariant: Variants = {
  hidden: { opacity: 0, scale: 0.8, originX: 0, originY: 0 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: springs.card,
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: { duration: durations.fast, ease: easings.analogEaseInOut },
  },
};

export const modalVariant: Variants = {
  hidden: { opacity: 0, y: -16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.modal, ease: easings.analogEaseOut },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: durations.pageOut, ease: easings.analogEaseInOut },
  },
};

export const tooltipVariant: Variants = {
  hidden: { opacity: 0, y: 6, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.18, ease: easings.analogEaseOut },
  },
  exit: {
    opacity: 0,
    y: 4,
    transition: { duration: 0.12, ease: easings.analogEaseInOut },
  },
};

export const pageVariant: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.pageIn, ease: easings.analogEaseOut },
  },
  exit: {
    opacity: 0,
    y: 6,
    transition: { duration: durations.pageOut, ease: easings.analogEaseInOut },
  },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.04,
    },
  },
};

export const itemStagger: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.base, ease: easings.analogSoft },
  },
};

export const errorShake: TargetAndTransition = {
  x: [0, -5, 5, -3, 3, 0],
  transition: {
    duration: 0.25,
    ease: easings.analogEaseOut,
  },
};

export const successBounce: TargetAndTransition = {
  scale: [1, 1.08, 0.98, 1],
  transition: {
    duration: 0.28,
    ease: easings.analogEaseOut,
  },
};

export const buttonMotion = {
  whileHover: { scale: 1.04 },
  whileTap: { scale: 0.95 },
  transition: springs.button,
};
