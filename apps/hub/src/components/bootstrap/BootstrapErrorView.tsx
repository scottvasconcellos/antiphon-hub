import type { BootstrapError } from '@/services/bootstrap/types';

interface BootstrapErrorViewProps {
  error: BootstrapError;
  onRetry: () => void;
  onOpenLogs: () => void;
  onExportSupportBundle: () => void;
  logLocationHint: string;
  statusMessage?: string;
  showHowTo: boolean;
  onToggleHowTo: () => void;
  onEnableMockMode?: () => void;
}

export const BootstrapErrorView = ({
  error,
  onRetry,
  onOpenLogs,
  onExportSupportBundle,
  logLocationHint,
  statusMessage,
  showHowTo,
  onToggleHowTo,
  onEnableMockMode,
}: BootstrapErrorViewProps) => (
  <main className="hub-blocking-screen" role="alert" data-testid="bootstrap-error-view">
    <section className="hub-blocking-card hub-blocking-card--error">
      <img src="/logos/Logo - transparent background white.png" alt="Antiphon Studios" className="hub-blocking-logo" />
      <h1>Hub startup failed</h1>
      <p>{error.userMessage}</p>
      <div className="hub-blocking-error-code">Code: {error.code}</div>

      <details>
        <summary>Details</summary>
        <pre>{error.technicalDetails ?? 'No technical details available.'}</pre>
      </details>

      {error.recoveryHints?.length ? (
        <ul className="hub-blocking-hints">
          {error.recoveryHints.map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ul>
      ) : null}

      <div className="hub-blocking-actions">
        {onEnableMockMode ? (
          <button
            type="button"
            className="is-primary"
            onClick={onEnableMockMode}
            title="Web dev only. Disables desktop commands."
          >
            Enable Mock Mode (dev)
          </button>
        ) : null}
        <button type="button" className="is-secondary" onClick={onRetry}>
          Retry bootstrap
        </button>
        <button type="button" className="is-tertiary" onClick={onToggleHowTo}>
          How to run
        </button>
      </div>

      {onEnableMockMode ? (
        <small className="hub-blocking-note">Web dev only. Disables desktop commands.</small>
      ) : null}

      {showHowTo ? (
        <section className="hub-blocking-howto">
          <p>Start this way:</p>
          <pre>{`pnpm dev:server\npnpm --filter @antiphon/hub tauri:dev`}</pre>
        </section>
      ) : null}

      <div className="hub-blocking-support">
        <button type="button" onClick={onOpenLogs}>
          Open logs
        </button>
        <button type="button" onClick={onExportSupportBundle}>
          Export support bundle
        </button>
      </div>
      <small>Logs are stored at: {logLocationHint}</small>
      {statusMessage ? <small className="hub-blocking-note">{statusMessage}</small> : null}
    </section>
  </main>
);
