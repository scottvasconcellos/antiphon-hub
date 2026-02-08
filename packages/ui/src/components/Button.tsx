import { buttonMotion } from '@antiphon/motion';
import clsx from 'clsx';
import { motion, type HTMLMotionProps } from 'framer-motion';
import type { PropsWithChildren } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant;
  loading?: boolean;
}

export const Button = ({
  variant = 'secondary',
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: PropsWithChildren<ButtonProps>) => (
  <motion.button
    type="button"
    className={clsx('a-btn', `a-btn--${variant}`, className)}
    disabled={disabled || loading}
    whileHover={buttonMotion.whileHover}
    whileTap={buttonMotion.whileTap}
    transition={buttonMotion.transition}
    {...rest}
  >
    {loading ? 'Working…' : children}
  </motion.button>
);
