import type {
  DownloadPipelineState,
  InstalledProductRecord,
  LicenseFile,
  Product,
  ReleaseManifest,
} from '@antiphon/core';
import { resolveProductStatus } from '@antiphon/core';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  downloadAndInstall,
  exportOfflineActivationRequest,
  importOfflineActivationResponse,
  launchProduct,
  openLogs,
  saveHubSettings,
  uninstallProduct,
  verifyInstalledApps,
  writeLicenseFile,
  writeSecureValue,
} from '@/lib/tauri';
import { apiClient } from '@/lib/api';
import { logger } from '@/services/logging/logger';
import { createToastCoalescer } from '@/services/logging/toastCoalescer';
import type { BootstrapPayload } from '@/services/bootstrap/types';
import { reconcileSelectedProductId } from './selection';

const publicKeyBase64 = 'ii0lvS9D770LYx3GcDqD6zFPTBaJdSvUGS1LK0J/EQ0=';

export type NavView = 'products' | 'installed' | 'updates' | 'licenses' | 'account' | 'settings' | 'diagnostics';
export type ProductViewMode = 'gallery' | 'list';
export type ProductFilter = 'all' | 'installed' | 'updates' | 'not-installed';
export type ProductSort = 'name' | 'recently-updated' | 'installed-date';

export interface DownloadJob {
  id: string;
  productId: string;
  state: DownloadPipelineState;
  downloadedBytes: number;
  totalBytes: number;
  speedBps: number;
  errorCode?: string;
  message?: string;
}

export interface HubSettings {
  downloadLocation?: string;
  uiSoundsEnabled: boolean;
  autoUpdateChecks: boolean;
}

export interface RuntimeError {
  title: string;
  code?: string;
  details?: string;
}

export interface UiToast {
  id: number;
  message: string;
}

interface HubState {
  nav: NavView;
  products: Product[];
  releases: Record<string, ReleaseManifest>;
  registry: Record<string, InstalledProductRecord>;
  search: string;
  viewMode: ProductViewMode;
  filter: ProductFilter;
  sort: ProductSort;
  selectedProductId?: string;
  jobs: DownloadJob[];
  settings: HubSettings;
  serialInput: string;
  serialProductId: string;
  runtimeError?: RuntimeError;
  accountToken?: string;
  platform?: { os: 'mac' | 'win' | 'linux'; arch: 'x64' | 'arm64' };
  runtimeMode?: 'tauri' | 'mock';
  toast?: UiToast;
  setNav: (nav: NavView) => void;
  setSearch: (search: string) => void;
  setViewMode: (mode: ProductViewMode) => void;
  setFilter: (filter: ProductFilter) => void;
  setSort: (sort: ProductSort) => void;
  setSelectedProductId: (id?: string) => void;
  reconcileSelectionWithVisibleProducts: (visibleProductIds: string[]) => void;
  setSerialInput: (value: string) => void;
  setSerialProductId: (value: string) => void;
  clearRuntimeError: () => void;
  clearToast: () => void;
  showToast: (message: string) => void;
  hydrateFromBootstrap: (payload: BootstrapPayload) => void;
  installSelected: () => Promise<void>;
  uninstallSelected: () => Promise<void>;
  launchSelected: () => Promise<void>;
  activateSerial: () => Promise<void>;
  exportOfflineRequest: () => Promise<void>;
  importOfflineResponse: () => Promise<void>;
  handleDownloadProgress: (event: {
    jobId: string;
    productId: string;
    state: DownloadPipelineState;
    downloadedBytes?: number;
    totalBytes?: number;
    speedBps?: number;
    errorCode?: string;
    message?: string;
  }) => void;
  saveSettings: (next: HubSettings) => Promise<void>;
  saveAccountToken: (value: string) => Promise<void>;
  runVerifyInstalled: () => Promise<void>;
  openLogs: () => Promise<void>;
}

const sortProducts = (
  products: Product[],
  releases: Record<string, ReleaseManifest>,
  registry: Record<string, InstalledProductRecord>,
  sort: ProductSort
): Product[] => {
  const copy = [...products];
  if (sort === 'name') {
    return copy.sort((a, b) => a.name.localeCompare(b.name));
  }
  if (sort === 'recently-updated') {
    return copy.sort((a, b) => {
      const aDate = releases[a.id]?.publishedAt ?? '';
      const bDate = releases[b.id]?.publishedAt ?? '';
      return bDate.localeCompare(aDate);
    });
  }
  return copy.sort((a, b) => {
    const aDate = registry[a.id]?.installedAt ?? '';
    const bDate = registry[b.id]?.installedAt ?? '';
    return bDate.localeCompare(aDate);
  });
};

const asRuntimeError = (fallbackTitle: string, fallbackCode: string, error: unknown): RuntimeError => ({
  title: fallbackTitle,
  code: fallbackCode,
  details: error instanceof Error ? error.message : String(error),
});

const toastCoalescer = createToastCoalescer({
  onShow: (toast) => {
    useHubStore.setState({ toast });
  },
  onHide: () => {
    useHubStore.setState({ toast: undefined });
  },
});

export const useHubStore = create<HubState>()(
  persist(
    (set, get) => ({
      nav: 'products',
      products: [],
      releases: {},
      registry: {},
      search: '',
      viewMode: 'gallery',
      filter: 'all',
      sort: 'name',
      jobs: [],
      settings: {
        autoUpdateChecks: true,
        uiSoundsEnabled: false,
      },
      serialInput: '',
      serialProductId: 'antiphon-dummy-product',
      setNav: (nav) =>
        set(
          nav === 'products'
            ? {
                nav,
                filter: 'all',
                search: '',
                sort: 'name',
                runtimeError: undefined,
              }
            : { nav, runtimeError: undefined }
        ),
      setSearch: (search) => set({ search }),
      setViewMode: (viewMode) => set({ viewMode }),
      setFilter: (filter) => set({ filter }),
      setSort: (sort) => set({ sort }),
      setSelectedProductId: (selectedProductId) => set({ selectedProductId }),
      reconcileSelectionWithVisibleProducts: (visibleProductIds) =>
        set((state) => {
          const nextSelected = visibleProductIds.includes(state.selectedProductId ?? '')
            ? state.selectedProductId
            : visibleProductIds[0];

          if (nextSelected === state.selectedProductId) {
            return {};
          }

          return { selectedProductId: nextSelected };
        }),
      setSerialInput: (serialInput) => set({ serialInput }),
      setSerialProductId: (serialProductId) => set({ serialProductId }),
      clearRuntimeError: () => set({ runtimeError: undefined }),
      clearToast: () => toastCoalescer.clear(),
      showToast: (message) => toastCoalescer.enqueue(message),
      hydrateFromBootstrap: (payload) => {
        const sorted = sortProducts(payload.products, payload.releases, payload.registry, get().sort);
        const selectedProductId = reconcileSelectedProductId(
          sorted,
          payload.selectedProductId ?? get().selectedProductId
        );
        set({
          nav: 'products',
          search: '',
          filter: 'all',
          sort: 'name',
          platform: payload.platform,
          runtimeMode: payload.runtimeMode,
          settings: payload.settings,
          products: sorted,
          releases: payload.releases,
          registry: payload.registry,
          selectedProductId,
          runtimeError: undefined,
        });
      },
      installSelected: async () => {
        const state = get();
        if (state.runtimeMode === 'mock') {
          set({
            runtimeError: {
              title: 'Unavailable in mock mode',
              code: 'MOCK_MODE_ACTION_BLOCKED',
              details: 'Install and update actions are disabled in mock mode.',
            },
          });
          return;
        }
        const selected = state.selectedProductId;
        if (!selected || !state.platform) {
          return;
        }

        const release = state.releases[selected];
        if (!release) {
          return;
        }

        const artifact = release.artifacts.find(
          (candidate) => candidate.os === state.platform?.os && candidate.arch === state.platform.arch
        );

        if (!artifact) {
          set({
            runtimeError: {
              title: 'No artifact for this platform',
              code: 'UNSUPPORTED_PLATFORM',
              details: `No ${state.platform.os}/${state.platform.arch} artifact is published for ${selected}.`,
            },
          });
          return;
        }

        const jobId = `${selected}-${Date.now()}`;

        set((previous) => ({
          jobs: [
            {
              id: jobId,
              productId: selected,
              state: 'queued',
              downloadedBytes: 0,
              totalBytes: artifact.sizeBytes,
              speedBps: 0,
            },
            ...previous.jobs.filter((job) => job.id !== jobId),
          ],
        }));

        try {
          const record = await downloadAndInstall({
            jobId,
            productId: selected,
            version: release.version,
            artifact,
            manifestPayload: JSON.stringify(release),
            manifestSignature: release.manifestSignature,
            publicKeyBase64,
          });

          set((previous) => ({
            registry: { ...previous.registry, [record.productId]: record },
          }));
        } catch (error) {
          logger.error('installSelected failed', { details: error instanceof Error ? error.message : String(error) });
          set({ runtimeError: asRuntimeError('Install failed', 'INSTALL_FAILED', error) });
        }
      },
      uninstallSelected: async () => {
        const state = get();
        if (state.runtimeMode === 'mock') {
          set({
            runtimeError: {
              title: 'Unavailable in mock mode',
              code: 'MOCK_MODE_ACTION_BLOCKED',
              details: 'Uninstall actions are disabled in mock mode.',
            },
          });
          return;
        }
        const selected = get().selectedProductId;
        if (!selected) {
          return;
        }
        try {
          await uninstallProduct(selected);
          set((state) => {
            const next = { ...state.registry };
            delete next[selected];
            return { registry: next };
          });
        } catch (error) {
          logger.error('uninstallSelected failed', { details: error instanceof Error ? error.message : String(error) });
          set({ runtimeError: asRuntimeError('Uninstall failed', 'UNINSTALL_FAILED', error) });
        }
      },
      launchSelected: async () => {
        const state = get();
        if (state.runtimeMode === 'mock') {
          set({
            runtimeError: {
              title: 'Unavailable in mock mode',
              code: 'MOCK_MODE_ACTION_BLOCKED',
              details: 'Launch actions are disabled in mock mode.',
            },
          });
          return;
        }
        const selected = get().selectedProductId;
        if (!selected) {
          return;
        }
        try {
          await launchProduct(selected);
        } catch (error) {
          logger.error('launchSelected failed', { details: error instanceof Error ? error.message : String(error) });
          set({ runtimeError: asRuntimeError('Launch failed', 'LAUNCH_FAILED', error) });
        }
      },
      activateSerial: async () => {
        const { serialInput, serialProductId } = get();
        if (!serialProductId) {
          return;
        }

        const deviceFingerprint = `${navigator?.platform ?? 'unknown'}-${navigator?.userAgent?.length ?? 0}`;

        try {
          const response = await apiClient.activate({
            serial: serialInput,
            productId: serialProductId,
            deviceFingerprint,
          });

          await writeSecureValue(`license-token:${serialProductId}`, response.token);
          await writeLicenseFile(serialProductId, response.licenseFile as LicenseFile);

          set({ serialInput: '' });
          toastCoalescer.enqueue('License activated');
        } catch (error) {
          logger.error('activateSerial failed', { details: error instanceof Error ? error.message : String(error) });
          set({ runtimeError: asRuntimeError('Activation failed', 'ACTIVATION_FAILED', error) });
        }
      },
      exportOfflineRequest: async () => {
        const { serialInput, serialProductId } = get();
        const payload = {
          serial: serialInput,
          productId: serialProductId,
          deviceFingerprint: `${navigator?.platform ?? 'unknown'}-${navigator?.userAgent?.length ?? 0}`,
          requestedAt: new Date().toISOString(),
        };

        try {
          await exportOfflineActivationRequest(JSON.stringify(payload, null, 2));
          toastCoalescer.enqueue('Offline request exported');
        } catch (error) {
          logger.error('exportOfflineRequest failed', { details: error instanceof Error ? error.message : String(error) });
          set({ runtimeError: asRuntimeError('Offline request export failed', 'OFFLINE_EXPORT_FAILED', error) });
        }
      },
      importOfflineResponse: async () => {
        try {
          const raw = await importOfflineActivationResponse();
          const data = JSON.parse(raw) as {
            productId: string;
            token: string;
          };

          await writeSecureValue(`license-token:${data.productId}`, data.token);
          toastCoalescer.enqueue('Offline response imported');
        } catch (error) {
          logger.error('importOfflineResponse failed', { details: error instanceof Error ? error.message : String(error) });
          set({ runtimeError: asRuntimeError('Offline response import failed', 'OFFLINE_IMPORT_FAILED', error) });
        }
      },
      handleDownloadProgress: (event) => {
        set((state) => ({
          jobs: state.jobs.map((job) =>
            job.id === event.jobId
              ? {
                  ...job,
                  state: event.state,
                  downloadedBytes: event.downloadedBytes ?? job.downloadedBytes,
                  totalBytes: event.totalBytes ?? job.totalBytes,
                  speedBps: event.speedBps ?? job.speedBps,
                  errorCode: event.errorCode,
                  message: event.message,
                }
              : job
          ),
        }));
      },
      saveSettings: async (settings) => {
        try {
          await saveHubSettings(settings);
          set({ settings });
          toastCoalescer.enqueue('Settings saved');
        } catch (error) {
          logger.error('saveSettings failed', { details: error instanceof Error ? error.message : String(error) });
          set({ runtimeError: asRuntimeError('Settings save failed', 'SETTINGS_SAVE_FAILED', error) });
        }
      },
      saveAccountToken: async (value) => {
        try {
          await writeSecureValue('account-token', value);
          set({ accountToken: value });
          toastCoalescer.enqueue('Account token saved');
        } catch (error) {
          logger.error('saveAccountToken failed', { details: error instanceof Error ? error.message : String(error) });
          set({ runtimeError: asRuntimeError('Account save failed', 'ACCOUNT_SAVE_FAILED', error) });
        }
      },
      runVerifyInstalled: async () => {
        const state = get();
        if (state.runtimeMode === 'mock') {
          logger.info('verify installed requested in mock mode');
          toastCoalescer.enqueue('Mock mode: verify installed apps is unavailable.');
          return;
        }
        try {
          const records = await verifyInstalledApps();
          set({ registry: Object.fromEntries(records.map((entry) => [entry.productId, entry])) });
          toastCoalescer.enqueue('Installed apps verified');
        } catch (error) {
          logger.error('runVerifyInstalled failed', { details: error instanceof Error ? error.message : String(error) });
          set({ runtimeError: asRuntimeError('Verification failed', 'VERIFY_FAILED', error) });
        }
      },
      openLogs: async () => {
        try {
          await openLogs();
        } catch (error) {
          logger.error('openLogs failed', { details: error instanceof Error ? error.message : String(error) });
          set({ runtimeError: asRuntimeError('Open logs failed', 'OPEN_LOGS_FAILED', error) });
        }
      },
    }),
    {
      name: 'antiphon-hub-state',
      partialize: (state) => ({
        viewMode: state.viewMode,
        jobs: state.jobs,
      }),
    }
  )
);

export const selectVisibleProducts = (state: HubState): Product[] => {
  const search = state.search.trim().toLowerCase();
  const filtered = state.products.filter((product) => {
    const status = resolveProductStatus(product, state.registry, state.releases[product.id]);
    if (state.filter === 'installed' && status !== 'installed') {
      return false;
    }
    if (state.filter === 'updates' && status !== 'update-available') {
      return false;
    }
    if (state.filter === 'not-installed' && status !== 'not-installed') {
      return false;
    }
    if (!search) {
      return true;
    }
    return [product.name, product.tagline, product.description].some((field) => field.toLowerCase().includes(search));
  });

  return sortProducts(filtered, state.releases, state.registry, state.sort);
};
