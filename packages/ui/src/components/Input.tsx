import clsx from 'clsx';
import type { InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = ({ label, hint, error, className, id, ...rest }: InputProps) => {
  const inputId = id ?? rest.name;
  return (
    <label className="a-field" htmlFor={inputId}>
      {label ? <span className="a-field__label">{label}</span> : null}
      <input id={inputId} className={clsx('a-input', error && 'a-input--error', className)} {...rest} />
      {error ? <span className="a-field__error">{error}</span> : hint ? <span className="a-field__hint">{hint}</span> : null}
    </label>
  );
};
