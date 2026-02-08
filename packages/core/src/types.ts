export type PlatformOS = 'mac' | 'win' | 'linux';
export type PlatformArch = 'x64' | 'arm64';

export type InstallerType = 'dmg' | 'pkg' | 'exe' | 'msi' | 'zip';

export type InstallStrategy =
  | {
      kind: 'portableZip';
      executableRelativePath: string;
      destination: 'user-selected' | 'apps-default';
    }
  | {
      kind: 'macAppCopy';
      bundleId: string;
      sourceType: 'dmg' | 'zip';
      destination: '/Applications' | '~/Applications';
    }
  | {
      kind: 'macPkg';
      packageId?: string;
    }
  | {
      kind: 'windowsInstaller';
      installerKind: 'exe' | 'msi';
      silentArgs?: string[];
      uninstallCommandHint?: string;
    };

export type ReleaseChannel = 'stable' | 'beta';

export type ProductCategory =
  | 'composition'
  | 'groove'
  | 'mixing'
  | 'utilities'
  | 'mastering'
  | 'effects';

export interface ProductPlatform {
  os: PlatformOS;
  arch: PlatformArch;
  installerType: InstallerType;
  installStrategy: InstallStrategy;
}

export interface Product {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: ProductCategory;
  iconPath?: string;
  iconUrl?: string;
  platforms: ProductPlatform[];
  currentVersion: string;
  releaseChannel: ReleaseChannel;
  purchase: {
    type: 'serial' | 'account';
    supportsOffline: boolean;
  };
  licensePolicy: {
    seats: number;
    offlineGraceDays: number;
    requiresAccount: boolean;
  };
}

export interface ReleaseArtifact {
  os: PlatformOS;
  arch: PlatformArch;
  installerType: InstallerType;
  installStrategy: InstallStrategy;
  url: string;
  sha256: string;
  sizeBytes: number;
  signature: string;
}

export interface ReleaseManifest {
  productId: string;
  version: string;
  publishedAt: string;
  notes: string;
  artifacts: ReleaseArtifact[];
  manifestSignature?: string;
}

export interface InstalledProductRecord {
  productId: string;
  installedVersion: string;
  installedAt: string;
  installLocation: string;
  installerType: InstallerType;
  channel: ReleaseChannel;
  lastLaunchedAt?: string;
  lastVerifiedAt?: string;
  integrityState: 'verified' | 'unverified' | 'failed';
}

export type DownloadPipelineState =
  | 'idle'
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'verifying'
  | 'installing'
  | 'complete'
  | 'error'
  | 'cancelled';

export type DownloadPipelineEvent =
  | 'QUEUE'
  | 'START'
  | 'PAUSE'
  | 'RESUME'
  | 'DOWNLOADED'
  | 'VERIFY_OK'
  | 'VERIFY_FAIL'
  | 'INSTALL_OK'
  | 'INSTALL_FAIL'
  | 'CANCEL'
  | 'RESET'
  | 'FAIL';

export interface LicenseTokenPayload {
  productId: string;
  serialHash: string;
  deviceFingerprint: string;
  issuedAt: string;
  expiresAt?: string;
  entitlements: string[];
}

export interface LicenseFile {
  productId: string;
  entitlements: string[];
  issuedAt: string;
  expiry?: string;
  signature: string;
}

export interface ActivationRequest {
  serial: string;
  productId: string;
  deviceFingerprint: string;
}

export interface ActivationResponse {
  token: string;
  licenseFile: LicenseFile;
}

export interface OfflineActivationRequestFile {
  serial: string;
  productId: string;
  deviceFingerprint: string;
  requestedAt: string;
}

export interface OfflineActivationResponseFile {
  productId: string;
  token: string;
  issuedAt: string;
  signature: string;
}
