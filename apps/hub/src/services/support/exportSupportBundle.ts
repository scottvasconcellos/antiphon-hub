import { logger } from '@/services/logging/logger';
import { getLogsLocationHint } from '@/services/platform/tauri';
import type { BootstrapError } from '@/services/bootstrap/types';
import { getRuntimeInfo, type RuntimeInfoInput } from '@/services/runtime/RuntimeService';

declare const __APP_VERSION__: string;

interface ExportSupportBundleOptions {
  settings: {
    downloadLocation?: string;
    uiSoundsEnabled: boolean;
    autoUpdateChecks: boolean;
  };
  bootstrapError?: BootstrapError;
  runtimeInfoInput?: RuntimeInfoInput;
}

const safeAppVersion = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.1.0';

export const buildSupportBundlePayload = ({ settings, bootstrapError, runtimeInfoInput }: ExportSupportBundleOptions) => {
  const runtime = getRuntimeInfo({
    appVersion: safeAppVersion,
    ...runtimeInfoInput,
  });
  return {
    generatedAt: new Date().toISOString(),
    appVersion: safeAppVersion,
    runtime: {
      platformDetected: runtime.platformDetected,
      isTauri: runtime.isTauri,
      tauri: runtime.isTauri,
      mockMode: runtime.mockMode,
      os: runtime.os,
      arch: runtime.arch,
      buildMode: runtime.buildMode,
      userAgent: globalThis.navigator?.userAgent ?? 'unknown',
      platform: globalThis.navigator?.platform ?? 'unknown',
    },
    settings: {
      downloadLocation: settings.downloadLocation ?? null,
      uiSoundsEnabled: settings.uiSoundsEnabled,
      autoUpdateChecks: settings.autoUpdateChecks,
    },
    bootstrapError: bootstrapError ?? null,
    logBuffer: logger.getBuffer(),
    logLocationHint: getLogsLocationHint(),
  };
};

export const exportSupportBundle = async ({
  settings,
  bootstrapError,
  runtimeInfoInput,
}: ExportSupportBundleOptions): Promise<string> => {
  const payload = buildSupportBundlePayload({ settings, bootstrapError, runtimeInfoInput });

  const fileName = `antiphon-support-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);

  logger.info('support bundle exported', { fileName });
  return fileName;
};
