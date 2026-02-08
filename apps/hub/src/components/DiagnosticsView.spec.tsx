import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DiagnosticsView } from '@/components/DiagnosticsView';

describe('DiagnosticsView actions', () => {
  it('shows export and copy actions disabled before first self-test run', () => {
    render(
      <DiagnosticsView
        bootstrapStatus="ready"
        runtimeMode="mock"
        platform={{ os: 'mac', arch: 'arm64' }}
        appVersion="0.1.0-test"
        buildMode="test"
        settings={{ autoUpdateChecks: true, uiSoundsEnabled: false }}
        onOpenLogs={async () => 'noop'}
      />
    );

    expect(screen.getByRole('button', { name: 'Run Self-Test' })).toBeInTheDocument();
    const exportButton = screen.getByTestId('diag-export-button');
    const copyButton = screen.getByTestId('diag-copy-button');
    expect(exportButton.tagName).toBe('BUTTON');
    expect(copyButton.tagName).toBe('BUTTON');
    expect(screen.getByRole('button', { name: 'Export Self-Test Report (JSON)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Copy Report' })).toBeDisabled();
    expect(screen.getByText('Run self-test to generate report.')).toBeInTheDocument();
  });
});
