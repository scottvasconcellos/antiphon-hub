import { detectPlatform } from '@/services/platform/paths';
import { isMockModeEnabled, isTauri } from '@/services/platform/tauri';

declare const __APP_VERSION__: string;

type RuntimeOs = 'mac' | 'win' | 'linux' | 'unknown';
type RuntimeArch = 'x64' | 'arm64' | 'unknown';

export interface RuntimeInfo {
  platformDetected: boolean;
  isTauri: boolean;
  mockMode: boolean;
  os: RuntimeOs;
  arch: RuntimeArch;
  version: string;
  buildMode: string;
}

export interface RuntimeInfoInput {
  platform?: { os: 'mac' | 'win' | 'linux'; arch: 'x64' | 'arm64' };
  runtimeMode?: 'tauri' | 'mock';
  appVersion?: string;
  buildMode?: string;
}

const detectArch = (): RuntimeArch => {
  const userAgent = globalThis.navigator?.userAgent?.toLowerCase() ?? '';
  if (userAgent.includes('arm64') || userAgent.includes('aarch64') || userAgent.includes('apple silicon')) {
    return 'arm64';
  }
  if (userAgent.length > 0) {
    return 'x64';
  }
  return 'unknown';
};

const safeVersion = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.1.0';

export const getRuntimeInfo = (input: RuntimeInfoInput = {}): RuntimeInfo => {
  const tauriDetected = isTauri();
  return {
    platformDetected: tauriDetected,
    isTauri: tauriDetected,
    mockMode: isMockModeEnabled() || input.runtimeMode === 'mock',
    os: input.platform?.os ?? (detectPlatform() as RuntimeOs),
    arch: input.platform?.arch ?? detectArch(),
    version: input.appVersion ?? safeVersion,
    buildMode: input.buildMode ?? import.meta.env.MODE ?? 'unknown',
  };
};
