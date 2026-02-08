import clsx from 'clsx';
import type { PropsWithChildren } from 'react';

export type ChipTone = 'neutral' | 'success' | 'warning' | 'danger';

export interface ChipProps {
  tone?: ChipTone;
}

export const Chip = ({ tone = 'neutral', children }: PropsWithChildren<ChipProps>) => (
  <span className={clsx('a-chip', `a-chip--${tone}`)}>{children}</span>
);
