import { useMemo, useState } from 'react';
import { Button, Card } from '@antiphon/ui';
import type { BootstrapStatus } from '@/services/bootstrap/types';
import { buildDiagnosticsRuntimeSummary, runDiagnosticsSelfTest } from '@/services/diagnostics/DiagnosticsService';
import type { SelfTestReport } from '@/services/diagnostics/types';
import type { HubSettings } from '@/state/hub-store';

interface DiagnosticsViewProps {
  bootstrapStatus: BootstrapStatus;
  runtimeMode?: 'tauri' | 'mock';
  platform?: { os: 'mac' | 'win' | 'linux'; arch: 'x64' | 'arm64' };
  appVersion: string;
  buildMode: string;
  settings: HubSettings;
  onOpenLogs: () => Promise<string>;
}

const downloadJson = (report: SelfTestReport) => {
  const fileName = `antiphon-self-test-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return fileName;
};

export const DiagnosticsView = ({
  bootstrapStatus,
  runtimeMode,
  platform,
  appVersion,
  buildMode,
  settings,
  onOpenLogs,
}: DiagnosticsViewProps) => {
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<SelfTestReport | undefined>();
  const [feedback, setFeedback] = useState<string | undefined>();

  const runtimeSummary = useMemo(
    () =>
      buildDiagnosticsRuntimeSummary({
        bootstrapStatus,
        runtimeMode,
        platform,
        appVersion,
        buildMode,
        settings,
        openLogsHandler: onOpenLogs,
      }),
    [appVersion, bootstrapStatus, buildMode, onOpenLogs, platform, runtimeMode, settings]
  );

  const runSelfTest = async () => {
    setIsRunning(true);
    setFeedback(undefined);
    try {
      const next = await runDiagnosticsSelfTest({
        bootstrapStatus,
        runtimeMode,
        platform,
        appVersion,
        buildMode,
        settings,
        openLogsHandler: onOpenLogs,
      });
      setReport(next);
      setFeedback(`Self-test completed: ${next.summary.pass} pass, ${next.summary.fail} fail, ${next.summary.skipped} skipped.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card className="hub-diagnostics" elevated>
      <h2>Diagnostics</h2>
      <p>Developer self-test for Phase 1-4 verification (bootstrap, workflows, state invariants, hardening).</p>

      <section className="hub-diagnostics__runtime">
        <h3>Runtime Summary</h3>
        <dl>
          <div>
            <dt>platformDetected</dt>
            <dd>{String(runtimeSummary.platformDetected)}</dd>
          </div>
          <div>
            <dt>isTauri</dt>
            <dd>{String(runtimeSummary.isTauri)}</dd>
          </div>
          <div>
            <dt>mockMode</dt>
            <dd>{String(runtimeSummary.mockMode)}</dd>
          </div>
          <div>
            <dt>os</dt>
            <dd>{runtimeSummary.os}</dd>
          </div>
          <div>
            <dt>arch</dt>
            <dd>{runtimeSummary.arch}</dd>
          </div>
          <div>
            <dt>version</dt>
            <dd>{runtimeSummary.version}</dd>
          </div>
          <div>
            <dt>buildMode</dt>
            <dd>{runtimeSummary.buildMode}</dd>
          </div>
        </dl>
      </section>

      <div className="hub-diagnostics__actions">
        <Button variant="primary" onClick={runSelfTest} loading={isRunning}>
          Run Self-Test
        </Button>
        <Button
          variant="secondary"
          disabled={!report}
          aria-disabled={!report}
          title={!report ? 'Run self-test to generate report.' : undefined}
          onClick={() => {
            if (!report) {
              return;
            }
            const fileName = downloadJson(report);
            setFeedback(`Self-test report exported: ${fileName}`);
          }}
        >
          Export Self-Test Report (JSON)
        </Button>
        <Button
          variant="secondary"
          disabled={!report}
          aria-disabled={!report}
          title={!report ? 'Run self-test to generate report.' : undefined}
          onClick={async () => {
            if (!report) {
              return;
            }

            if (!navigator.clipboard?.writeText) {
              setFeedback('Clipboard not available in this runtime.');
              return;
            }

            try {
              await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
              setFeedback('Self-test report copied to clipboard.');
            } catch {
              setFeedback('Copy failed in this runtime.');
            }
          }}
        >
          Copy Report
        </Button>
      </div>

      {!report ? <small className="hub-diagnostics__hint">Run self-test to generate report.</small> : null}

      {feedback ? <p className="hub-diagnostics__feedback">{feedback}</p> : null}

      {report ? (
        <>
          <div className="hub-diagnostics__summary">
            <span>PASS: {report.summary.pass}</span>
            <span>FAIL: {report.summary.fail}</span>
            <span>SKIPPED: {report.summary.skipped}</span>
          </div>

          <div className="hub-diagnostics__table-wrap">
            <table className="hub-diagnostics__table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Phase</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Details</th>
                  <th>Remediation</th>
                </tr>
              </thead>
              <tbody>
                {report.checks.map((check) => (
                  <tr key={check.id}>
                    <td>{check.id}</td>
                    <td>{check.phase}</td>
                    <td>{check.name}</td>
                    <td>
                      <span className={`hub-diagnostics__status hub-diagnostics__status--${check.status.toLowerCase()}`}>
                        {check.status}
                      </span>
                    </td>
                    <td>{check.details}</td>
                    <td>{check.remediationHint ?? 'n/a'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </Card>
  );
};
