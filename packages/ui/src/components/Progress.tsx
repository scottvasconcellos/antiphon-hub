import type { HTMLAttributes } from 'react';

interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
}

export const Progress = ({ value, ...rest }: ProgressProps) => {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="a-progress" {...rest}>
      <div className="a-progress__bar" style={{ width: `${clamped}%` }} />
    </div>
  );
};
