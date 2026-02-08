import type { Product, ReleaseManifest } from '@antiphon/core';
import { releaseManifestSchema } from '@antiphon/core';
import { apiClient } from '@/lib/api';
import { getBootstrapState, getPlatformInfo } from '@/lib/tauri';
import offlineCatalog from '@/data/offline-catalog.json';
import offlineRelease from '@/data/offline-release-antiphon-dummy-product.json';
import { logger } from '@/services/logging/logger';
import { PlatformServiceError, isMockModeEnabled, isTauri } from '@/services/platform/tauri';
import type { BootstrapError, BootstrapPayload } from './types';

const localReleases: Record<string, ReleaseManifest> = {
  [offlineRelease.productId]: releaseManifestSchema.parse(offlineRelease),
};

const defaultTimeoutMs = 10_000;

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Timeout while ${label} (${timeoutMs}ms)`));
      }, timeoutMs);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const normalizeBootstrapError = (error: unknown): BootstrapError => {
  if (error instanceof PlatformServiceError) {
    return {
      code: error.code,
      userMessage: error.userMessage,
      technicalDetails: error.technicalDetails,
      recoveryHints: error.recoveryHints,
    };
  }

  if (error instanceof Error) {
    return {
      code: 'BOOTSTRAP_FAILED',
      userMessage: 'Hub startup failed before it could become interactive.',
      technicalDetails: error.stack ? `${error.message}\n${error.stack}` : error.message,
      recoveryHints: ['Retry bootstrap.', 'Check mock server if running in dev.', 'Open logs for additional context.'],
    };
  }

  return {
    code: 'BOOTSTRAP_FAILED',
    userMessage: 'Hub startup failed before it could become interactive.',
    technicalDetails: String(error),
    recoveryHints: ['Retry bootstrap.'],
  };
};

interface RunBootstrapOptions {
  timeoutMs?: number;
  onStep?: (stepLabel: string) => void;
}

class BootstrapService {
  async run(options: RunBootstrapOptions = {}): Promise<BootstrapPayload> {
    const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;

    const emitStep = (stepLabel: string) => {
      logger.info('bootstrap step', { stepLabel });
      options.onStep?.(stepLabel);
    };

    try {
      emitStep('Checking desktop bridge…');

      const runtimeMode = isTauri() ? 'tauri' : isMockModeEnabled() ? 'mock' : null;
      if (!runtimeMode) {
        throw new PlatformServiceError({
          code: 'TAURI_UNAVAILABLE',
          userMessage:
            'This Hub runs as a desktop app. You are viewing the web dev server without the desktop bridge.',
          technicalDetails:
            'Tauri runtime was not detected and mock mode is disabled. Browser mode cannot call desktop commands.',
          recoveryHints: [
            'Run: pnpm dev:server',
            'Run: pnpm --filter @antiphon/hub tauri:dev',
            'In dev, enable mock mode and retry.',
          ],
        });
      }

      emitStep('Loading local hub state…');
      const [platform, bootstrap] = await withTimeout(
        Promise.all([getPlatformInfo(), getBootstrapState()]),
        timeoutMs,
        'loading local hub state'
      );

      emitStep('Loading catalog…');
      let products: Product[];
      try {
        products = await withTimeout(apiClient.getCatalog(), timeoutMs, 'fetching catalog');
      } catch (error) {
        logger.warn('catalog fetch failed, using offline fallback', {
          details: error instanceof Error ? error.message : String(error),
        });
        products = offlineCatalog as Product[];
      }

      emitStep('Loading release manifests…');
      const releases: Record<string, ReleaseManifest> = { ...localReleases };
      await Promise.all(
        products.map(async (product) => {
          try {
            releases[product.id] = await withTimeout(
              apiClient.getReleaseManifest(product.id),
              timeoutMs,
              `fetching release manifest for ${product.id}`
            );
          } catch (error) {
            const fallback = localReleases[product.id];
            if (fallback) {
              releases[product.id] = fallback;
            } else {
              logger.warn('release manifest fetch failed with no fallback', {
                productId: product.id,
                details: error instanceof Error ? error.message : String(error),
              });
            }
          }
        })
      );

      emitStep('Preparing download manager and registry…');
      const registry = Object.fromEntries(bootstrap.registry.map((entry) => [entry.productId, entry]));
      const selectedProductId = products[0]?.id;

      emitStep('Startup complete');

      return {
        platform,
        settings: bootstrap.settings,
        registry,
        products,
        releases,
        selectedProductId,
        runtimeMode,
      };
    } catch (error) {
      logger.error('bootstrap failed', {
        details: error instanceof Error ? error.message : String(error),
      });
      throw normalizeBootstrapError(error);
    }
  }
}

export const bootstrapService = new BootstrapService();
