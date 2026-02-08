interface BootstrapLoadingViewProps {
  stepLabel: string;
}

export const BootstrapLoadingView = ({ stepLabel }: BootstrapLoadingViewProps) => (
  <main className="hub-blocking-screen" aria-busy="true" data-testid="bootstrap-loading-view">
    <section className="hub-blocking-card">
      <img src="/logos/Logo - transparent background white.png" alt="Antiphon Studios" className="hub-blocking-logo" />
      <h1>Starting Antiphon Hub</h1>
      <p>{stepLabel}</p>
      <div className="hub-blocking-progress" aria-hidden="true">
        <span />
      </div>
    </section>
  </main>
);
