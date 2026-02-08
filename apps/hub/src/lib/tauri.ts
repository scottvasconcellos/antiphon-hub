import type { InstalledProductRecord, LicenseFile, PlatformArch, PlatformOS, ReleaseArtifact } from '@antiphon/core';
import { safeInvoke, safeListen } from '@/services/platform/tauri';

export interface PlatformInfo {
  os: PlatformOS;
  arch: PlatformArch;
}

export interface HubSettings {
  downloadLocation?: string;
  uiSoundsEnabled: boolean;
  autoUpdateChecks: boolean;
}

export interface DownloadInstallRequest {
  jobId: string;
  productId: string;
  version: string;
  artifact: ReleaseArtifact;
  manifestSignature?: string;
  manifestPayload: string;
  publicKeyBase64: string;
}

export interface DownloadProgressEvent {
  jobId: string;
  productId: string;
  state: string;
  downloadedBytes?: number;
  totalBytes?: number;
  speedBps?: number;
  errorCode?: string;
  message?: string;
}

export interface HubBootstrap {
  registry: InstalledProductRecord[];
  settings: HubSettings;
}

export const getPlatformInfo = () => safeInvoke<PlatformInfo>('current_platform');

export const getBootstrapState = () => safeInvoke<HubBootstrap>('get_hub_state');

export const saveHubSettings = (settings: HubSettings) => safeInvoke<void>('save_settings', { settings });

export const downloadAndInstall = (request: DownloadInstallRequest) =>
  safeInvoke<InstalledProductRecord>('download_and_install', { request });

export const uninstallProduct = (productId: string) => safeInvoke<void>('uninstall_product', { productId });

export const launchProduct = (productId: string) => safeInvoke<void>('launch_product', { productId });

export const readSecureValue = (key: string) => safeInvoke<string | null>('read_secure_value', { key });

export const writeSecureValue = (key: string, value: string) => safeInvoke<void>('write_secure_value', { key, value });

export const writeLicenseFile = (productId: string, license: LicenseFile) =>
  safeInvoke<void>('write_license_file', { productId, license });

export const exportOfflineActivationRequest = (payload: string) =>
  safeInvoke<string>('export_offline_activation_request', { payload });

export const importOfflineActivationResponse = () => safeInvoke<string>('import_offline_activation_response');

export const verifyInstalledApps = () => safeInvoke<InstalledProductRecord[]>('verify_installed_apps');

export const openLogs = () => safeInvoke<void>('open_logs');

export const onDownloadProgress = (handler: (event: DownloadProgressEvent) => void) =>
  safeListen<DownloadProgressEvent>('download-progress', (payload) => {
    handler(payload);
  });
