import { logger } from '@/services/logging/logger';
import { mockInvoke } from './mockBackend';
import { getDefaultDownloadDir, getLogDir } from './paths';

export interface PlatformErrorShape {
  code: string;
  userMessage: string;
  technicalDetails?: string;
  recoveryHints?: string[];
}

export class PlatformServiceError extends Error {
  code: string;

  userMessage: string;

  technicalDetails?: string;

  recoveryHints?: string[];

  constructor({ code, userMessage, technicalDetails, recoveryHints }: PlatformErrorShape) {
    super(userMessage);
    this.name = 'PlatformServiceError';
    this.code = code;
    this.userMessage = userMessage;
    this.technicalDetails = technicalDetails;
    this.recoveryHints = recoveryHints;
  }
}

const MOCK_MODE_KEY = 'antiphon:mock-mode';
const privilegedCommands = new Set([
  'download_and_install',
  'uninstall_product',
  'launch_product',
  'verify_installed_apps',
]);
const platformDiagnostics = {
  safeInvokeCallCount: 0,
  safeListenCallCount: 0,
  commands: [] as string[],
  invokeAccessedDirectly: false,
};
const pushDiagnosticCommand = (command: string) => {
  platformDiagnostics.commands.push(command);
  if (platformDiagnostics.commands.length > 200) {
    platformDiagnostics.commands.splice(0, platformDiagnostics.commands.length - 200);
  }
};

const asErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.stack ? `${error.message}\n${error.stack}` : error.message;
  }
  return String(error);
};

export const isTauri = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  const candidate = window as Window & {
    __TAURI__?: {
      core?: unknown;
    };
    __TAURI_INTERNALS__?: {
      invoke?: unknown;
    };
  };

  return Boolean(candidate.__TAURI_INTERNALS__?.invoke || candidate.__TAURI__?.core);
};

export const isMockModeEnabled = (): boolean => {
  if (!import.meta.env.DEV) {
    return false;
  }
  if (typeof window === 'undefined') {
    return false;
  }
  return window.localStorage.getItem(MOCK_MODE_KEY) === '1';
};

export const setMockModeEnabled = (enabled: boolean): void => {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(MOCK_MODE_KEY, enabled ? '1' : '0');
  logger.info(`Mock mode ${enabled ? 'enabled' : 'disabled'}.`, {
    mockMode: enabled,
  });
};

export const getLogsLocationHint = (): string => {
  return getLogDir();
};

export const getDefaultDownloadPathHint = (): string => {
  return getDefaultDownloadDir();
};

const ensurePlatformReady = (): void => {
  if (isTauri()) {
    return;
  }
  if (isMockModeEnabled()) {
    return;
  }
  throw new PlatformServiceError({
    code: 'TAURI_UNAVAILABLE',
    userMessage: 'Desktop bridge is unavailable.',
    technicalDetails:
      'Tauri APIs are not present in this runtime. Open the desktop app or enable mock mode for browser development.',
    recoveryHints: [
      'Run: pnpm dev:server',
      'Run: pnpm --filter @antiphon/hub tauri:dev',
      'In browser dev only: enable mock mode and retry bootstrap.',
    ],
  });
};

export const safeInvoke = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
  platformDiagnostics.safeInvokeCallCount += 1;
  pushDiagnosticCommand(command);

  ensurePlatformReady();

  if (isMockModeEnabled()) {
    if (privilegedCommands.has(command)) {
      throw new PlatformServiceError({
        code: 'MOCK_MODE_BLOCKED',
        userMessage: 'Unavailable in mock mode.',
        technicalDetails: `Command ${command} is blocked while mock mode is enabled.`,
        recoveryHints: ['Disable mock mode and run desktop bridge for system-changing commands.'],
      });
    }
    return mockInvoke<T>(command, args);
  }

  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<T>(command, args);
    } catch (error) {
      const details = asErrorMessage(error);
      logger.error('Tauri invoke failed', { command, details });
      throw new PlatformServiceError({
        code: 'TAURI_INVOKE_FAILED',
        userMessage: 'Desktop bridge call failed.',
        technicalDetails: details,
        recoveryHints: ['Retry bootstrap.', 'If issue persists, open logs and export support bundle.'],
      });
    }
  }

  try {
    return await mockInvoke<T>(command, args);
  } catch (error) {
    const details = asErrorMessage(error);
    logger.warn('Mock invoke failed', { command, details });
    throw new PlatformServiceError({
      code: 'MOCK_INVOKE_FAILED',
      userMessage: 'Mock backend command failed.',
      technicalDetails: details,
      recoveryHints: ['Disable mock mode and run Tauri desktop dev.', 'Retry bootstrap.'],
    });
  }
};

export const safeListen = async <T>(
  eventName: string,
  handler: (payload: T) => void
): Promise<() => void> => {
  platformDiagnostics.safeListenCallCount += 1;
  pushDiagnosticCommand(`listen:${eventName}`);

  if (isTauri()) {
    const { listen } = await import('@tauri-apps/api/event');
    return listen<T>(eventName, (event) => {
      handler(event.payload);
    });
  }

  logger.info('safeListen noop in non-tauri runtime', { eventName });
  return () => {
    // noop
  };
};

export const getPlatformDiagnostics = () => ({
  safeInvokeCallCount: platformDiagnostics.safeInvokeCallCount,
  safeListenCallCount: platformDiagnostics.safeListenCallCount,
  commands: [...platformDiagnostics.commands],
  invokeAccessedDirectly: platformDiagnostics.invokeAccessedDirectly,
});
