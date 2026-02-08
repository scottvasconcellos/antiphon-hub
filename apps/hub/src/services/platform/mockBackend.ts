import type { InstalledProductRecord } from '@antiphon/core';

interface MockSettings {
  downloadLocation?: string;
  uiSoundsEnabled: boolean;
  autoUpdateChecks: boolean;
}

interface DownloadAndInstallArgs {
  request: {
    productId: string;
    version: string;
    artifact: {
      installerType: string;
    };
  };
}

const secureStore = new Map<string, string>();

let settings: MockSettings = {
  autoUpdateChecks: true,
  uiSoundsEnabled: false,
};

let registry: InstalledProductRecord[] = [];

const guessPlatform = () => {
  const platform = globalThis.navigator?.platform?.toLowerCase() ?? '';
  const isMac = platform.includes('mac');
  const isWin = platform.includes('win');
  return {
    os: isMac ? 'mac' : isWin ? 'win' : 'linux',
    arch: platform.includes('arm') ? 'arm64' : 'x64',
  };
};

export const mockInvoke = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
  switch (command) {
    case 'current_platform':
      return guessPlatform() as T;
    case 'get_hub_state':
      return {
        registry,
        settings,
      } as T;
    case 'save_settings': {
      const next = (args?.settings as MockSettings | undefined) ?? settings;
      settings = { ...next };
      return undefined as T;
    }
    case 'write_secure_value': {
      const key = String(args?.key ?? '');
      const value = String(args?.value ?? '');
      secureStore.set(key, value);
      return undefined as T;
    }
    case 'read_secure_value': {
      const key = String(args?.key ?? '');
      return (secureStore.get(key) ?? null) as T;
    }
    case 'verify_installed_apps':
      return registry as T;
    case 'open_logs':
      return undefined as T;
    case 'write_license_file':
      return undefined as T;
    case 'export_offline_activation_request':
      return '/mock/Documents/Antiphon/offline-activation-request.json' as T;
    case 'import_offline_activation_response':
      throw new Error('MOCK_RESPONSE_FILE_MISSING');
    case 'download_and_install': {
      const payload = args as DownloadAndInstallArgs | undefined;
      if (!payload) {
        throw new Error('MOCK_INVALID_INSTALL_ARGS');
      }
      const now = new Date().toISOString();
      const record: InstalledProductRecord = {
        productId: payload.request.productId,
        installedVersion: payload.request.version,
        installedAt: now,
        installLocation: `/mock/Applications/${payload.request.productId}`,
        installerType: payload.request.artifact.installerType as InstalledProductRecord['installerType'],
        channel: 'stable',
        integrityState: 'verified',
        lastVerifiedAt: now,
      };
      registry = [record, ...registry.filter((entry) => entry.productId !== record.productId)];
      return record as T;
    }
    case 'uninstall_product': {
      const productId = String(args?.productId ?? '');
      registry = registry.filter((entry) => entry.productId !== productId);
      return undefined as T;
    }
    case 'launch_product':
      return undefined as T;
    default:
      throw new Error(`MOCK_UNSUPPORTED_COMMAND:${command}`);
  }
};
