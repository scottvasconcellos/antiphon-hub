import type { InstalledProductRecord, Product, ReleaseManifest } from '@antiphon/core';

export type BootstrapStatus = 'idle' | 'booting' | 'ready' | 'failed';

export interface BootstrapError {
  code: string;
  userMessage: string;
  technicalDetails?: string;
  recoveryHints?: string[];
}

export interface BootstrapState {
  status: BootstrapStatus;
  stepLabel: string;
  error?: BootstrapError;
  runtimeMode?: 'tauri' | 'mock';
}

export interface BootstrapPayload {
  platform: { os: 'mac' | 'win' | 'linux'; arch: 'x64' | 'arm64' };
  settings: {
    downloadLocation?: string;
    uiSoundsEnabled: boolean;
    autoUpdateChecks: boolean;
  };
  registry: Record<string, InstalledProductRecord>;
  products: Product[];
  releases: Record<string, ReleaseManifest>;
  selectedProductId?: string;
  runtimeMode: 'tauri' | 'mock';
}
