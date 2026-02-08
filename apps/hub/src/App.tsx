import '@antiphon/ui/styles.css';
import './app.css';
import { useEffect, useMemo, useReducer, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ErrorBanner, Sidebar } from '@antiphon/ui';
import { pageVariant } from '@antiphon/motion';
import { resolveProductStatus } from '@antiphon/core';
import { onDownloadProgress, openLogs } from '@/lib/tauri';
import { AccountView } from '@/components/AccountView';
import { BootstrapErrorView } from '@/components/bootstrap/BootstrapErrorView';
import { BootstrapLoadingView } from '@/components/bootstrap/BootstrapLoadingView';
import { DiagnosticsView } from '@/components/DiagnosticsView';
import { DownloadManagerDrawer } from '@/components/DownloadManagerDrawer';
import { LicensesView } from '@/components/LicensesView';
import { ProductDetailPanel } from '@/components/ProductDetailPanel';
import { ProductsPanel } from '@/components/ProductsPanel';
import { SettingsView } from '@/components/SettingsView';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { selectVisibleProducts, useHubStore } from '@/state/hub-store';
import { bootstrapService } from '@/services/bootstrap/BootstrapService';
import { bootstrapReducer, initialBootstrapState } from '@/services/bootstrap/bootstrapReducer';
import { logger } from '@/services/logging/logger';
import { exportSupportBundle } from '@/services/support/exportSupportBundle';
import { isMockModeEnabled, isTauri, setMockModeEnabled } from '@/services/platform/tauri';
import { getDefaultDownloadDir, getLogDir } from '@/services/platform/paths';
import type { BootstrapError } from '@/services/bootstrap/types';

const baseNavItems = [
  { id: 'products', label: 'Products' },
  { id: 'installed', label: 'Installed' },
  { id: 'updates', label: 'Updates' },
  { id: 'licenses', label: 'Licenses' },
  { id: 'account', label: 'Account' },
  { id: 'settings', label: 'Settings' },
] as const;

const normalizeBootstrapError = (error: unknown): BootstrapError => {
  if (error && typeof error === 'object' && 'code' in error && 'userMessage' in error) {
    return error as BootstrapError;
  }

  if (error instanceof Error) {
    return {
      code: 'BOOTSTRAP_FAILED',
      userMessage: 'Hub startup failed before it could become interactive.',
      technicalDetails: error.stack ? `${error.message}\n${error.stack}` : error.message,
      recoveryHints: ['Retry bootstrap.'],
    };
  }

  return {
    code: 'BOOTSTRAP_FAILED',
    userMessage: 'Hub startup failed before it could become interactive.',
    technicalDetails: String(error),
    recoveryHints: ['Retry bootstrap.'],
  };
};

function App() {
  const [accountTokenInput, setAccountTokenInput] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const [showHowTo, setShowHowTo] = useState(false);
  const [bootstrapStatusMessage, setBootstrapStatusMessage] = useState<string | undefined>();
  const state = useHubStore();
  const reconcileSelectionWithVisibleProducts = state.reconcileSelectionWithVisibleProducts;
  const diagnosticsEnabled =
    import.meta.env.DEV ||
    (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('diag') === '1');
  const navItems = useMemo(
    () =>
      diagnosticsEnabled
        ? [...baseNavItems, { id: 'diagnostics', label: 'Diagnostics' as const }]
        : baseNavItems,
    [diagnosticsEnabled]
  );
  const [bootstrapState, dispatchBootstrap] = useReducer(bootstrapReducer, initialBootstrapState);
  const compactFilters = useMediaQuery('(max-width: 1024px)');
  const collapseListToCards = useMediaQuery('(max-width: 768px)');
  const isProductRoute = state.nav === 'products' || state.nav === 'installed' || state.nav === 'updates';
  const appVersion = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.1.0';

  const resetBootstrapAndRetry = () => {
    dispatchBootstrap({ type: 'BOOT_RESET' });
    setBootstrapStatusMessage(undefined);
    state.clearRuntimeError();
    setRetryToken((value) => value + 1);
  };

  useEffect(() => {
    let cancelled = false;

    const runBootstrap = async () => {
      dispatchBootstrap({ type: 'BOOT_START' });
      setShowHowTo(false);

      try {
        const payload = await bootstrapService.run({
          onStep: (stepLabel) => {
            if (!cancelled) {
              dispatchBootstrap({ type: 'BOOT_STEP', stepLabel });
            }
          },
        });

        if (cancelled) {
          return;
        }

        useHubStore.getState().hydrateFromBootstrap(payload);
        dispatchBootstrap({ type: 'BOOT_READY', runtimeMode: payload.runtimeMode });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const normalized = normalizeBootstrapError(error);
        logger.error('bootstrap gate failed', {
          code: normalized.code,
          details: normalized.technicalDetails,
        });
        dispatchBootstrap({ type: 'BOOT_FAILED', error: normalized });
      }
    };

    void runBootstrap();

    return () => {
      cancelled = true;
    };
  }, [retryToken]);

  useEffect(() => {
    if (!diagnosticsEnabled && state.nav === 'diagnostics') {
      state.setNav('products');
    }
  }, [diagnosticsEnabled, state.nav, state.setNav]);

  useEffect(() => {
    if (bootstrapState.status !== 'ready') {
      return;
    }

    let active = true;
    let cleanup: (() => void) | undefined;

    void onDownloadProgress((event) => {
      useHubStore.getState().handleDownloadProgress({
        ...event,
        state: event.state as never,
      });
    }).then((unlisten) => {
      if (active) {
        cleanup = unlisten;
      } else {
        unlisten();
      }
    });

    return () => {
      active = false;
      cleanup?.();
    };
  }, [bootstrapState.status]);

  const visibleProducts = useMemo(() => {
    if (state.nav === 'installed') {
      return state.products.filter(
        (product) => resolveProductStatus(product, state.registry, state.releases[product.id]) === 'installed'
      );
    }

    if (state.nav === 'updates') {
      return state.products.filter(
        (product) => resolveProductStatus(product, state.registry, state.releases[product.id]) === 'update-available'
      );
    }

    return selectVisibleProducts(state);
  }, [state.nav, state.products, state.registry, state.releases, state.search, state.filter, state.sort]);

  const visibleProductIds = useMemo(() => visibleProducts.map((product) => product.id), [visibleProducts]);

  useEffect(() => {
    if (!isProductRoute) {
      return;
    }
    reconcileSelectionWithVisibleProducts(visibleProductIds);
  }, [isProductRoute, reconcileSelectionWithVisibleProducts, visibleProductIds]);

  const selectedProduct = visibleProducts.find((product) => product.id === state.selectedProductId);
  const selectedRelease = selectedProduct ? state.releases[selectedProduct.id] : undefined;
  const selectedStatus = selectedProduct
    ? resolveProductStatus(selectedProduct, state.registry, state.releases[selectedProduct.id])
    : undefined;
  const activeJob = state.jobs.find((job) => job.productId === state.selectedProductId);
  const catalogIsEmpty = state.products.length === 0;
  const filteredListIsEmpty = state.nav === 'products' && visibleProducts.length === 0 && !catalogIsEmpty;
  const detailEmptyState = catalogIsEmpty ? 'catalog-empty' : filteredListIsEmpty ? 'filtered-empty' : 'no-selection';
  const handleOpenLogs = async (options?: { suppressGlobalToast?: boolean }) => {
    const suppressGlobalToast = options?.suppressGlobalToast === true;
    const logPath = getLogDir();
    if (!isTauri()) {
      const message = `Logs are stored at: ${logPath}. Browser mode only has in-memory logs.`;
      if (!suppressGlobalToast) {
        state.showToast(message);
      }
      return message;
    }
    try {
      await openLogs();
      const message = `Logs opened. Stored at: ${logPath}`;
      if (!suppressGlobalToast) {
        state.showToast(message);
      }
      return message;
    } catch (error) {
      logger.error('open logs from settings failed', {
        details: error instanceof Error ? error.message : String(error),
      });
      const message = `Could not open logs automatically. Logs are stored at: ${logPath}`;
      if (!suppressGlobalToast) {
        state.showToast(message);
      }
      return message;
    }
  };

  const statusByProduct = Object.fromEntries(
    state.products.map((product) => [product.id, resolveProductStatus(product, state.registry, state.releases[product.id])])
  );

  if (bootstrapState.status === 'idle' || bootstrapState.status === 'booting') {
    return <BootstrapLoadingView stepLabel={bootstrapState.stepLabel} />;
  }

  if (bootstrapState.status === 'failed') {
    const canEnableMock =
      import.meta.env.DEV &&
      bootstrapState.error?.code === 'TAURI_UNAVAILABLE' &&
      !isMockModeEnabled();

    return (
      <BootstrapErrorView
        error={bootstrapState.error ?? normalizeBootstrapError('Unknown bootstrap failure')}
        onRetry={resetBootstrapAndRetry}
        onOpenLogs={async () => {
          const logPath = getLogDir();
          if (!isTauri()) {
            setBootstrapStatusMessage(
              `Desktop log directory is ${logPath}. Browser mode cannot open native logs; use exported support bundle for in-memory logs.`
            );
            return;
          }
          try {
            await openLogs();
            setBootstrapStatusMessage(`Logs opened. Logs are stored at: ${logPath}`);
          } catch (error) {
            setBootstrapStatusMessage(
              `Could not open logs automatically. Logs are stored at: ${logPath}. ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        }}
        onExportSupportBundle={async () => {
          try {
            await exportSupportBundle({
              settings: state.settings,
              bootstrapError: bootstrapState.error,
              runtimeInfoInput: {
                platform: state.platform,
                runtimeMode: state.runtimeMode,
                appVersion,
                buildMode: import.meta.env.MODE,
              },
            });
            setBootstrapStatusMessage('Support bundle exported.');
          } catch (error) {
            setBootstrapStatusMessage(
              `Support bundle export failed. ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }}
        logLocationHint={getLogDir()}
        statusMessage={bootstrapStatusMessage}
        showHowTo={showHowTo}
        onToggleHowTo={() => setShowHowTo((value) => !value)}
        onEnableMockMode={
          canEnableMock
            ? () => {
                setMockModeEnabled(true);
                resetBootstrapAndRetry();
              }
            : undefined
        }
      />
    );
  }

  return (
    <div className="hub-app" data-testid="hub-ready-root">
      <Sidebar
        items={navItems.map((item) => ({ id: item.id, label: item.label }))}
        activeId={state.nav}
        onSelect={(id) => state.setNav(id as never)}
      />

      <main className="hub-main">
        <header className="hub-header">
          <img src="/logos/Logo - transparent background white.png" alt="Antiphon Studios" />
          <div>
            <h1>Antiphon Hub</h1>
            <p>Install, update, license, and launch Antiphon products.</p>
            {state.runtimeMode === 'mock' ? (
              <span className="hub-runtime-badge">
                Running in mock mode - UI validation only. No real installs or system changes.
              </span>
            ) : null}
          </div>
        </header>

        {state.runtimeError ? (
          <ErrorBanner title={state.runtimeError.title} code={state.runtimeError.code} details={state.runtimeError.details} />
        ) : null}

        {state.toast ? <div className="hub-toast">{state.toast.message}</div> : null}

        {isProductRoute ? (
          <section className="hub-content" data-testid={`route-${state.nav}`}>
            <AnimatePresence mode="wait">
              <motion.div key={state.nav} variants={pageVariant} initial="hidden" animate="visible" exit="exit">
                <ProductsPanel
                  products={visibleProducts}
                  catalogIsEmpty={catalogIsEmpty}
                  search={state.search}
                  selectedProductId={state.selectedProductId}
                  releasesVersionMap={Object.fromEntries(
                    state.products.map((product) => [product.id, state.releases[product.id]?.version ?? product.currentVersion])
                  )}
                  statusByProduct={statusByProduct}
                  viewMode={state.viewMode}
                  filter={state.filter}
                  sort={state.sort}
                  compactFilters={compactFilters}
                  collapseListToCards={collapseListToCards}
                  onSelectProduct={state.setSelectedProductId}
                  onSetViewMode={state.setViewMode}
                  onSetFilter={state.setFilter}
                  onSetSort={state.setSort}
                  onSearch={state.setSearch}
                />
              </motion.div>
            </AnimatePresence>

            <ProductDetailPanel
              product={selectedProduct}
              emptyState={detailEmptyState}
              release={selectedRelease}
              status={selectedStatus}
              isMockMode={state.runtimeMode === 'mock'}
              installedVersion={selectedProduct ? state.registry[selectedProduct.id]?.installedVersion : undefined}
              job={activeJob}
              onInstall={state.installSelected}
              onLaunch={state.launchSelected}
              onUninstall={state.uninstallSelected}
            />
          </section>
        ) : (
          <section className="hub-content hub-content--single" data-testid={`route-${state.nav}`}>
            <AnimatePresence mode="wait">
              {state.nav === 'licenses' ? (
                <motion.div
                  key="licenses"
                  variants={pageVariant}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <LicensesView
                    products={state.products}
                    serialInput={state.serialInput}
                    serialProductId={state.serialProductId}
                    onSerialInput={state.setSerialInput}
                    onSerialProduct={state.setSerialProductId}
                    onActivate={state.activateSerial}
                    onExportOfflineRequest={state.exportOfflineRequest}
                    onImportOfflineResponse={state.importOfflineResponse}
                  />
                </motion.div>
              ) : null}

              {state.nav === 'account' ? (
                <motion.div
                  key="account"
                  variants={pageVariant}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <AccountView
                    token={accountTokenInput}
                    onTokenChange={setAccountTokenInput}
                    onSave={async () => {
                      await state.saveAccountToken(accountTokenInput);
                    }}
                  />
                </motion.div>
              ) : null}

              {state.nav === 'settings' ? (
                <motion.div
                  key="settings"
                  variants={pageVariant}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <SettingsView
                    settings={state.settings}
                    isMockMode={state.runtimeMode === 'mock'}
                    resolvedDownloadPath={getDefaultDownloadDir()}
                    onSave={state.saveSettings}
                    onBrowseDownloadLocation={() => {
                      logger.info('download location browse clicked (stub)');
                      state.showToast('Folder picker not wired yet (Tauri integration pending).');
                    }}
                    onCopyDownloadPath={async () => {
                      const text = state.settings.downloadLocation ?? getDefaultDownloadDir();
                      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
                        state.showToast('Copy not supported here.');
                        return;
                      }
                      try {
                        await navigator.clipboard.writeText(text);
                        state.showToast('Path copied');
                      } catch {
                        state.showToast('Copy not supported here.');
                      }
                    }}
                    onVerifyInstalled={state.runVerifyInstalled}
                    onOpenLogs={async () => {
                      await handleOpenLogs();
                    }}
                    onExportSupportBundle={async () => {
                      await exportSupportBundle({
                        settings: state.settings,
                        runtimeInfoInput: {
                          platform: state.platform,
                          runtimeMode: state.runtimeMode,
                          appVersion,
                          buildMode: import.meta.env.MODE,
                        },
                      });
                      state.showToast('Support bundle exported');
                    }}
                  />
                </motion.div>
              ) : null}

              {state.nav === 'diagnostics' ? (
                <motion.div
                  key="diagnostics"
                  variants={pageVariant}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <DiagnosticsView
                    bootstrapStatus={bootstrapState.status}
                    runtimeMode={state.runtimeMode}
                    platform={state.platform}
                    appVersion={appVersion}
                    buildMode={import.meta.env.MODE}
                    settings={state.settings}
                    onOpenLogs={() => handleOpenLogs({ suppressGlobalToast: true })}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>
        )}

        <DownloadManagerDrawer jobs={state.jobs} />
      </main>
    </div>
  );
}

export default App;
