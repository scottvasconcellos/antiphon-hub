import clsx from 'clsx';
import { motion, type HTMLMotionProps } from 'framer-motion';
import type { PropsWithChildren } from 'react';
import { cardEntranceVariant } from '@antiphon/motion';

export interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  elevated?: boolean;
}

export const Card = ({ elevated = false, className, children, ...rest }: PropsWithChildren<CardProps>) => (
  <motion.div
    className={clsx('a-card', elevated && 'a-card--elevated', className)}
    variants={cardEntranceVariant}
    initial="hidden"
    animate="visible"
    exit="exit"
    layout
    {...rest}
  >
    {children}
  </motion.div>
);
