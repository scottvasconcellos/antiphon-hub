import type { PropsWithChildren } from 'react';

export interface ErrorBannerProps {
  title: string;
  code?: string;
  details?: string;
}

export const ErrorBanner = ({ title, code, details }: PropsWithChildren<ErrorBannerProps>) => (
  <section className="a-error-banner" role="alert">
    <strong>{title}</strong>
    {code ? <span className="a-error-banner__code">Code: {code}</span> : null}
    {details ? <details><summary>Details</summary><p>{details}</p></details> : null}
  </section>
);
