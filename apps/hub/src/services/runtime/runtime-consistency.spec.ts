import { describe, expect, it } from 'vitest';
import { buildDiagnosticsRuntimeSummary } from '@/services/diagnostics/DiagnosticsService';
import { buildSupportBundlePayload } from '@/services/support/exportSupportBundle';

describe('runtime consistency', () => {
  it('keeps diagnostics runtime summary and support bundle runtime fields aligned', () => {
    localStorage.clear();
    localStorage.setItem('antiphon:mock-mode', '1');

    const context = {
      bootstrapStatus: 'ready' as const,
      runtimeMode: 'mock' as const,
      platform: { os: 'mac' as const, arch: 'arm64' as const },
      appVersion: '0.1.0-test',
      buildMode: 'test',
      settings: {
        autoUpdateChecks: true,
        uiSoundsEnabled: false,
      },
      openLogsHandler: async () => 'noop',
    };

    const runtimeSummary = buildDiagnosticsRuntimeSummary(context);
    const payload = buildSupportBundlePayload({
      settings: context.settings,
      runtimeInfoInput: {
        platform: context.platform,
        runtimeMode: context.runtimeMode,
        appVersion: context.appVersion,
        buildMode: context.buildMode,
      },
    });

    expect(payload.runtime.platformDetected).toBe(runtimeSummary.platformDetected);
    expect(payload.runtime.isTauri).toBe(runtimeSummary.isTauri);
    expect(payload.runtime.mockMode).toBe(runtimeSummary.mockMode);
    expect(payload.runtime.os).toBe(runtimeSummary.os);
    expect(payload.runtime.arch).toBe(runtimeSummary.arch);
  });
});
