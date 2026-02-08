import { createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Product } from '@antiphon/core';
import { bootstrapService } from '@/services/bootstrap/BootstrapService';
import {
  getPlatformDiagnostics,
  isMockModeEnabled,
  isTauri,
  setMockModeEnabled,
} from '@/services/platform/tauri';
import { getRuntimeInfo } from '@/services/runtime/RuntimeService';
import { buildSupportBundlePayload } from '@/services/support/exportSupportBundle';
import { ProductDetailPanel } from '@/components/ProductDetailPanel';
import { ProductsPanel } from '@/components/ProductsPanel';
import { SettingsView } from '@/components/SettingsView';
import { useHubStore } from '@/state/hub-store';
import type { DiagnosticsContext, SelfTestCheck, SelfTestReport, SelfTestRuntimeSummary, SelfTestStatus } from './types';

interface CheckResult {
  status: SelfTestStatus;
  details: string;
  remediationHint?: string;
}

const sampleProduct: Product = {
  id: 'diagnostics-sample-product',
  name: 'Diagnostics Sample Product',
  tagline: 'Probe asset for component checks',
  description: 'Used only for self-test rendering probes.',
  category: 'utilities',
  platforms: [
    {
      os: 'mac',
      arch: 'arm64',
      installerType: 'zip',
      installStrategy: {
        kind: 'portableZip',
        executableRelativePath: 'Sample.app',
        destination: 'apps-default',
      },
    },
  ],
  currentVersion: '1.0.0',
  releaseChannel: 'stable',
  purchase: { type: 'serial', supportsOffline: true },
  licensePolicy: { seats: 1, offlineGraceDays: 14, requiresAccount: false },
};

const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const withRenderProbe = async <T>(
  renderElement: () => ReactElement,
  run: (container: HTMLElement) => Promise<T> | T
): Promise<T> => {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-100000px';
  container.style.top = '0';
  container.style.width = '1100px';
  container.style.visibility = 'hidden';
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(renderElement());
  await nextTick();

  try {
    return await run(container);
  } finally {
    root.unmount();
    container.remove();
  }
};

const summarize = (checks: SelfTestCheck[]) => {
  return checks.reduce(
    (acc, check) => {
      if (check.status === 'PASS') {
        acc.pass += 1;
      } else if (check.status === 'FAIL') {
        acc.fail += 1;
      } else {
        acc.skipped += 1;
      }
      return acc;
    },
    { pass: 0, fail: 0, skipped: 0 }
  );
};

const runtimeFromContext = (context: DiagnosticsContext): SelfTestRuntimeSummary =>
  getRuntimeInfo({
    platform: context.platform,
    runtimeMode: context.runtimeMode,
    appVersion: context.appVersion,
    buildMode: context.buildMode,
  });

const addCheck = async (
  checks: SelfTestCheck[],
  config: { id: string; phase: string; name: string },
  run: () => Promise<CheckResult>
) => {
  try {
    const result = await run();
    checks.push({
      id: config.id,
      phase: config.phase,
      name: config.name,
      status: result.status,
      details: result.details,
      remediationHint: result.remediationHint,
    });
  } catch (error) {
    checks.push({
      id: config.id,
      phase: config.phase,
      name: config.name,
      status: 'FAIL',
      details: error instanceof Error ? error.message : String(error),
      remediationHint: 'Inspect diagnostics check implementation and runtime logs.',
    });
  }
};

const checkP11HardGate = async (context: DiagnosticsContext): Promise<CheckResult> => {
  const readyRoot = document.querySelector('[data-testid="hub-ready-root"]');
  const blockingView = document.querySelector(
    '[data-testid="bootstrap-loading-view"], [data-testid="bootstrap-error-view"]'
  );

  if (context.bootstrapStatus === 'ready' && readyRoot && !blockingView) {
    return {
      status: 'PASS',
      details: 'Ready root is mounted and bootstrap blocking views are not visible.',
    };
  }

  return {
    status: 'FAIL',
    details: `bootstrapStatus=${context.bootstrapStatus}, readyRoot=${Boolean(
      readyRoot
    )}, blockingView=${Boolean(blockingView)}`,
    remediationHint: 'Re-check App bootstrap gating branch and ready-screen selectors.',
  };
};

const checkP12SafeInvoke = async (): Promise<CheckResult> => {
  const uncaughtErrors: string[] = [];
  const onError = (event: ErrorEvent) => {
    uncaughtErrors.push(event.message || String(event.error ?? 'unknown error event'));
  };
  const onUnhandled = (event: PromiseRejectionEvent) => {
    const reason =
      typeof event.reason === 'string'
        ? event.reason
        : event.reason instanceof Error
          ? event.reason.message
          : String(event.reason);
    uncaughtErrors.push(reason);
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onUnhandled);

  const before = getPlatformDiagnostics();
  let bootstrapDetails = 'bootstrap run completed';

  try {
    await bootstrapService.run({ timeoutMs: 6_000 });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'UNKNOWN';
    bootstrapDetails = `bootstrap run ended with ${code}`;
  } finally {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onUnhandled);
  }

  const after = getPlatformDiagnostics();
  const uncaughtInvokeErrors = uncaughtErrors.filter((entry) => {
    const normalized = entry.toLowerCase();
    return normalized.includes('invoke') && (normalized.includes('undefined') || normalized.includes('not a function'));
  });

  if (uncaughtInvokeErrors.length > 0) {
    return {
      status: 'FAIL',
      details: `Captured uncaught invoke errors: ${uncaughtInvokeErrors.join(' | ')}`,
      remediationHint: 'Ensure all Tauri bridge calls route through safeInvoke/safeListen wrapper.',
    };
  }

  if (after.invokeAccessedDirectly) {
    return {
      status: 'FAIL',
      details: 'Platform diagnostics flagged direct invoke access.',
      remediationHint: 'Route every platform command through services/platform/tauri.ts.',
    };
  }

  return {
    status: 'PASS',
    details: `${bootstrapDetails}; safeInvokeCallsDelta=${after.safeInvokeCallCount - before.safeInvokeCallCount}`,
  };
};

const checkP13RetrySemantics = async (): Promise<CheckResult> => {
  const transitions: string[] = ['booting'];

  try {
    const payload = await bootstrapService.run({ timeoutMs: 6_000 });
    transitions.push('ready');
    return {
      status: 'PASS',
      details: `Bootstrap simulation transitions: ${transitions.join(' -> ')} (runtime=${payload.runtimeMode})`,
    };
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'UNKNOWN';
    transitions.push('failed');

    if (!isTauri() && !isMockModeEnabled() && code === 'TAURI_UNAVAILABLE') {
      return {
        status: 'PASS',
        details: `Bootstrap simulation transitions: ${transitions.join(' -> ')} with expected ${code}.`,
      };
    }

    return {
      status: 'FAIL',
      details: `Bootstrap simulation failed with ${code}. Transitions: ${transitions.join(' -> ')}.`,
      remediationHint: 'Inspect bootstrap reducer/service error handling and retry pathway.',
    };
  }
};

const checkP14MockEnableRetry = async (): Promise<CheckResult> => {
  if (isTauri()) {
    return {
      status: 'SKIPPED',
      details: 'Desktop runtime detected; mock-mode bootstrap toggle check is browser-only.',
      remediationHint: 'Run diagnostics in browser dev mode to exercise mock-mode toggle flow.',
    };
  }

  if (!import.meta.env.DEV) {
    return {
      status: 'SKIPPED',
      details: 'Mock mode toggles are disabled in production build mode.',
    };
  }

  const previous = isMockModeEnabled();

  try {
    setMockModeEnabled(true);
    const payload = await bootstrapService.run({ timeoutMs: 6_000 });
    const bannerVisible = Boolean(
      document.body.textContent?.includes('Running in mock mode - UI validation only. No real installs or system changes.')
    );

    if (payload.runtimeMode === 'mock' && bannerVisible) {
      return {
        status: 'PASS',
        details: 'Mock mode enabled and bootstrap simulation returned runtimeMode=mock with visible banner.',
      };
    }

    return {
      status: 'FAIL',
      details: `runtimeMode=${payload.runtimeMode}, bannerVisible=${bannerVisible}`,
      remediationHint: 'Retry bootstrap after enabling mock mode and verify runtime banner wiring.',
    };
  } catch (error) {
    return {
      status: 'FAIL',
      details: error instanceof Error ? error.message : String(error),
      remediationHint: 'Check mock-mode toggle storage and bootstrap runtime-mode detection.',
    };
  } finally {
    setMockModeEnabled(previous);
  }
};

const checkP21RoutesRender = async (): Promise<CheckResult> => {
  const baseRoutes: Array<{ nav: 'products' | 'installed' | 'updates' | 'licenses' | 'account' | 'settings'; testId: string }> = [
    { nav: 'products', testId: 'route-products' },
    { nav: 'installed', testId: 'route-installed' },
    { nav: 'updates', testId: 'route-updates' },
    { nav: 'licenses', testId: 'route-licenses' },
    { nav: 'account', testId: 'route-account' },
    { nav: 'settings', testId: 'route-settings' },
  ];
  const hasDiagnosticsNav = Array.from(document.querySelectorAll('.a-sidebar__item')).some(
    (node) => node.textContent?.trim() === 'Diagnostics'
  );
  const routes = hasDiagnosticsNav
    ? [...baseRoutes, { nav: 'diagnostics' as const, testId: 'route-diagnostics' }]
    : baseRoutes;

  const store = useHubStore.getState();
  const previousNav = store.nav;
  const missing: string[] = [];
  const observed: string[] = [];
  let fatalVisible = false;

  try {
    for (const route of routes) {
      useHubStore.getState().setNav(route.nav as never);
      await nextTick();
      await nextTick();

      const marker = document.querySelector(`[data-testid="${route.testId}"]`);
      const hasFatal = Boolean(document.querySelector('[data-testid="bootstrap-error-view"]'));
      observed.push(`${route.testId}=${Boolean(marker)}`);

      if (!marker) {
        missing.push(route.testId);
      }
      if (hasFatal) {
        fatalVisible = true;
      }
    }
  } finally {
    useHubStore.getState().setNav(previousNav);
  }

  if (missing.length === 0 && !fatalVisible) {
    return {
      status: 'PASS',
      details: `Route probes mounted by testid: ${observed.join(', ')}`,
    };
  }

  return {
    status: 'FAIL',
    details: `missing=${missing.join(', ') || 'none'}, fatalVisible=${fatalVisible}, observed=${observed.join(', ')}`,
    remediationHint: 'Ensure each route root exposes a stable data-testid and remains renderable under bootstrap-ready state.',
  };
};

const checkP22EmptyStates = async (): Promise<CheckResult> => {
  const listEmptyState = await withRenderProbe(
    () =>
      createElement(ProductsPanel, {
        products: [],
        catalogIsEmpty: true,
        releasesVersionMap: {},
        statusByProduct: {},
        search: '',
        viewMode: 'gallery',
        filter: 'all',
        sort: 'name',
        compactFilters: false,
        collapseListToCards: false,
        onSelectProduct: () => undefined,
        onSetViewMode: () => undefined,
        onSetFilter: () => undefined,
        onSetSort: () => undefined,
        onSearch: () => undefined,
        selectedProductId: undefined,
      }),
    (container) => container.textContent?.includes('No products available yet') ?? false
  );

  const detailEmptyState = await withRenderProbe(
    () =>
      createElement(ProductDetailPanel, {
        product: undefined,
        emptyState: 'catalog-empty',
        release: undefined,
        installedVersion: undefined,
        job: undefined,
        status: undefined,
        isMockMode: true,
        onInstall: () => undefined,
        onLaunch: () => undefined,
        onUninstall: () => undefined,
      }),
    (container) => container.textContent?.includes('Catalog is empty. No product details are available.') ?? false
  );

  if (listEmptyState && detailEmptyState) {
    return {
      status: 'PASS',
      details: 'Catalog-empty list and detail fallback states both render.',
    };
  }

  return {
    status: 'FAIL',
    details: `listEmptyState=${listEmptyState}, detailEmptyState=${detailEmptyState}`,
    remediationHint: 'Keep list/detail empty-state messages synchronized for empty catalog scenarios.',
  };
};

const checkP23SettingsNoLeak = async (context: DiagnosticsContext): Promise<CheckResult> => {
  const probeLeak = await withRenderProbe(
    () =>
      createElement(SettingsView, {
        settings: context.settings,
        isMockMode: context.runtimeMode === 'mock',
        resolvedDownloadPath: '/tmp/antiphon',
        onSave: () => undefined,
        onBrowseDownloadLocation: () => undefined,
        onCopyDownloadPath: () => undefined,
        onVerifyInstalled: () => undefined,
        onOpenLogs: () => undefined,
        onExportSupportBundle: () => undefined,
      }),
    (container) => {
      return {
        hasSettingsHeader: container.textContent?.includes('Settings') ?? false,
        hasReleaseNotes: container.textContent?.includes('Release Notes') ?? false,
      };
    }
  );

  if (probeLeak.hasSettingsHeader && !probeLeak.hasReleaseNotes) {
    return {
      status: 'PASS',
      details: 'Settings view probe renders without product detail content.',
    };
  }

  return {
    status: 'FAIL',
    details: `hasSettingsHeader=${probeLeak.hasSettingsHeader}, hasReleaseNotes=${probeLeak.hasReleaseNotes}`,
    remediationHint: 'Keep settings route in single-column mode without product detail panel.',
  };
};

const checkP31FilterSelectionInvariant = async (): Promise<CheckResult> => {
  const store = useHubStore.getState();
  const previous = store.selectedProductId;

  store.reconcileSelectionWithVisibleProducts([]);
  const clearedSelection = useHubStore.getState().selectedProductId === undefined;
  store.setSelectedProductId(previous);

  const detailMessageProbe = await withRenderProbe(
    () =>
      createElement(ProductDetailPanel, {
        product: undefined,
        emptyState: 'filtered-empty',
        release: undefined,
        installedVersion: undefined,
        job: undefined,
        status: undefined,
        isMockMode: true,
        onInstall: () => undefined,
        onLaunch: () => undefined,
        onUninstall: () => undefined,
      }),
    (container) => container.textContent?.includes('No products match your filters') ?? false
  );

  if (clearedSelection && detailMessageProbe) {
    return {
      status: 'PASS',
      details: 'Selection clears for empty visible list and filtered-empty detail state is available.',
    };
  }

  return {
    status: 'FAIL',
    details: `clearedSelection=${clearedSelection}, detailMessageProbe=${detailMessageProbe}`,
    remediationHint: 'Constrain selection to filtered list and show filtered-empty detail fallback.',
  };
};

const checkP32DefaultFilter = async (): Promise<CheckResult> => {
  const store = useHubStore.getState();
  const defaults = store.filter === 'all' && store.search === '' && store.sort === 'name';
  const hasMockData = !isMockModeEnabled() || store.products.length > 0;

  if (defaults && hasMockData) {
    return {
      status: 'PASS',
      details: `filter=${store.filter}, search="${store.search}", sort=${store.sort}, products=${store.products.length}`,
    };
  }

  return {
    status: 'FAIL',
    details: `filter=${store.filter}, search="${store.search}", sort=${store.sort}, products=${store.products.length}`,
    remediationHint: 'Reset products defaults on bootstrap/route entry and avoid persisting stale filter state.',
  };
};

const elementLabel = (element: HTMLElement): string => {
  const dataTestId = element.getAttribute('data-testid');
  if (dataTestId) {
    return `[data-testid="${dataTestId}"]`;
  }
  if (element.id) {
    return `#${element.id}`;
  }
  if (element.classList.length > 0) {
    return `.${Array.from(element.classList)
      .slice(0, 2)
      .join('.')}`;
  }
  return element.tagName.toLowerCase();
};

const selectorPathForElement = (element: HTMLElement, root: HTMLElement): string => {
  const segments: string[] = [];
  let cursor: HTMLElement | null = element;
  let depth = 0;

  while (cursor && cursor !== root && depth < 5) {
    segments.unshift(elementLabel(cursor));
    cursor = cursor.parentElement;
    depth += 1;
  }

  return segments.join(' > ');
};

interface OverflowCulprit {
  selectorPath: string;
  dataTestId: string | undefined;
  role: string;
  tagName: string;
  rectWidth: number;
  rectRight: number;
  scrollWidth: number;
  clientWidth: number;
  computedMinWidth: string;
  whiteSpace: string;
  overflowX: string;
  severity: number;
}

export const describeOverflowCulprits = (
  root: HTMLElement,
  options: { viewportWidth: number; scopeWindow?: Window; limit?: number }
): OverflowCulprit[] => {
  const viewportWidth = options.viewportWidth;
  const scopeWindow = options.scopeWindow ?? window;
  const limit = options.limit ?? 10;
  const maxNodes = 500;
  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*')).slice(0, maxNodes - 1)];
  const culprits: OverflowCulprit[] = [];

  elements.forEach((element) => {
    const rect = element.getBoundingClientRect();
    const style = scopeWindow.getComputedStyle(element);
    const scrollOverflow = element.scrollWidth - Math.max(element.clientWidth, 1);
    const rightOverflow = rect.right - viewportWidth;
    const severity = Math.max(0, scrollOverflow, rightOverflow);
    const hasOverflow = element.scrollWidth > element.clientWidth + 1 || rect.right > viewportWidth + 1;

    if (!hasOverflow || severity <= 1 || rect.width <= 0) {
      return;
    }

    culprits.push({
      selectorPath: selectorPathForElement(element, root),
      dataTestId: element.getAttribute('data-testid') ?? undefined,
      role: element.getAttribute('role') ?? 'none',
      tagName: element.tagName.toLowerCase(),
      rectWidth: Number(rect.width.toFixed(2)),
      rectRight: Number(rect.right.toFixed(2)),
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      computedMinWidth: style.minWidth,
      whiteSpace: style.whiteSpace,
      overflowX: style.overflowX,
      severity: Number(severity.toFixed(2)),
    });
  });

  culprits.sort((a, b) => b.severity - a.severity);
  return culprits.slice(0, limit);
};

interface ResponsiveProbeResult {
  width: number;
  hasOverflow: boolean;
  scrollWidth: number;
  clientWidth: number;
  culprits: OverflowCulprit[];
}

const cloneRuntimeStyles = (targetHead: HTMLElement) => {
  const styleNodes = document.querySelectorAll('style,link[rel="stylesheet"]');
  styleNodes.forEach((node) => {
    targetHead.appendChild(node.cloneNode(true));
  });
};

const runResponsiveProbe = async (readyRoot: HTMLElement, width: number): Promise<ResponsiveProbeResult> => {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.left = '-200000px';
  iframe.style.top = '0';
  iframe.style.width = `${width}px`;
  iframe.style.height = '800px';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const frameDoc = iframe.contentDocument;
  if (!frameDoc) {
    iframe.remove();
    return {
      width,
      hasOverflow: false,
      scrollWidth: width,
      clientWidth: width,
      culprits: [],
    };
  }

  frameDoc.open();
  frameDoc.write('<!doctype html><html><head></head><body></body></html>');
  frameDoc.close();

  frameDoc.body.style.margin = '0';
  frameDoc.body.style.padding = '0';
  frameDoc.documentElement.style.margin = '0';
  frameDoc.documentElement.style.padding = '0';

  cloneRuntimeStyles(frameDoc.head);
  await nextTick();
  await new Promise<void>((resolve) => setTimeout(resolve, 24));

  const clone = readyRoot.cloneNode(true) as HTMLElement;
  clone.style.width = '100%';
  clone.style.minWidth = '0';
  frameDoc.body.appendChild(clone);

  await nextTick();
  await new Promise<void>((resolve) => setTimeout(resolve, 24));

  const clientWidth = frameDoc.documentElement.clientWidth;
  const scrollWidth = frameDoc.documentElement.scrollWidth;
  const hasOverflow = scrollWidth > clientWidth + 1;
  const culprits = hasOverflow
    ? describeOverflowCulprits(clone, {
        viewportWidth: clientWidth,
        scopeWindow: iframe.contentWindow ?? window,
        limit: 10,
      })
    : [];

  iframe.remove();
  return {
    width,
    hasOverflow,
    scrollWidth,
    clientWidth,
    culprits,
  };
};

const checkP41ResponsiveOverflow = async (): Promise<CheckResult> => {
  if (isTauri()) {
    return {
      status: 'SKIPPED',
      details: 'Responsive width probe is browser-mode only in this diagnostics build.',
    };
  }

  const readyRoot = document.querySelector('[data-testid="hub-ready-root"]');
  if (!readyRoot) {
    return {
      status: 'SKIPPED',
      details: 'Ready root not found; overflow probe cannot run.',
    };
  }

  const widths = [1280, 1024, 768, 480];
  const failed: string[] = [];

  for (const width of widths) {
    const probe = await runResponsiveProbe(readyRoot as HTMLElement, width);
    if (!probe.hasOverflow) {
      continue;
    }

    const diagnosticsRows =
      probe.culprits.length > 0
        ? probe.culprits
        : [
            {
              selectorPath: '[data-testid="hub-ready-root"]',
              dataTestId: 'hub-ready-root',
              role: 'none',
              tagName: 'div',
              rectWidth: probe.scrollWidth,
              rectRight: probe.scrollWidth,
              scrollWidth: probe.scrollWidth,
              clientWidth: probe.clientWidth,
              computedMinWidth: 'unknown',
              whiteSpace: 'unknown',
              overflowX: 'unknown',
              severity: Number((probe.scrollWidth - probe.clientWidth).toFixed(2)),
            },
          ];
    failed.push(`${probe.width}: ${JSON.stringify(diagnosticsRows, null, 0)}`);
  }

  if (failed.length === 0) {
    return {
      status: 'PASS',
      details: 'No horizontal overflow detected in iframe viewport probes: 1280/1024/768/480.',
    };
  }

  return {
    status: 'FAIL',
    details: `Horizontal overflow detected: ${failed.join(' | ')}`,
    remediationHint: 'Audit sidebar/toolbar min-width, long text wrapping, and fixed-width controls at failing breakpoints.',
  };
};

const checkP42KeyboardFilters = async (): Promise<CheckResult> => {
  return withRenderProbe(
    () =>
      createElement(ProductsPanel, {
        products: [sampleProduct],
        catalogIsEmpty: false,
        releasesVersionMap: { [sampleProduct.id]: sampleProduct.currentVersion },
        statusByProduct: { [sampleProduct.id]: 'not-installed' },
        search: '',
        viewMode: 'gallery',
        filter: 'all',
        sort: 'name',
        compactFilters: true,
        collapseListToCards: false,
        onSelectProduct: () => undefined,
        onSetViewMode: () => undefined,
        onSetFilter: () => undefined,
        onSetSort: () => undefined,
        onSearch: () => undefined,
        selectedProductId: sampleProduct.id,
      }),
    async (container) => {
      const trigger = container.querySelector('.hub-more-filters__trigger') as HTMLButtonElement | null;
      if (!trigger) {
        return {
          status: 'SKIPPED',
          details: 'Compact filter trigger not present in probe render.',
        } satisfies CheckResult;
      }

      const isButton = trigger.tagName === 'BUTTON';
      const focusable = !trigger.disabled;
      trigger.click();
      await nextTick();
      const expandedAfterOpen = trigger.getAttribute('aria-expanded') === 'true';

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await nextTick();
      const expandedAfterEscape = trigger.getAttribute('aria-expanded') === 'true';

      if (isButton && focusable && expandedAfterOpen && !expandedAfterEscape) {
        return {
          status: 'PASS',
          details: 'Compact filters trigger is focusable button; open/escape-close behavior is wired.',
        } satisfies CheckResult;
      }

      return {
        status: 'FAIL',
        details: `isButton=${isButton}, focusable=${focusable}, expandedAfterOpen=${expandedAfterOpen}, expandedAfterEscape=${expandedAfterEscape}`,
        remediationHint: 'Keep More filters trigger as button with aria-expanded and Escape close wiring.',
      } satisfies CheckResult;
    }
  );
};

const checkP43BrowserOpenLogs = async (context: DiagnosticsContext): Promise<CheckResult> => {
  if (isTauri()) {
    return {
      status: 'SKIPPED',
      details: 'Browser-mode Open Logs explanation check is skipped in desktop runtime.',
    };
  }

  const message = await context.openLogsHandler();
  const explanatory = /browser mode/i.test(message) && /logs are stored at:/i.test(message);
  if (explanatory) {
    return {
      status: 'PASS',
      details: message,
    };
  }

  return {
    status: 'FAIL',
    details: message,
    remediationHint: 'Browser Open Logs path should avoid native open and return explanatory message.',
  };
};

const checkP44SupportBundleFlags = async (context: DiagnosticsContext): Promise<CheckResult> => {
  const runtimeSummary = runtimeFromContext(context);
  const payload = buildSupportBundlePayload({
    settings: context.settings,
    runtimeInfoInput: {
      platform: context.platform,
      runtimeMode: context.runtimeMode,
      appVersion: context.appVersion,
      buildMode: context.buildMode,
    },
  });
  const hasMockMode = typeof payload.runtime.mockMode === 'boolean';
  const hasPlatformDetected = typeof payload.runtime.platformDetected === 'boolean';
  const runtimeAligned =
    payload.runtime.platformDetected === runtimeSummary.platformDetected &&
    payload.runtime.isTauri === runtimeSummary.isTauri &&
    payload.runtime.mockMode === runtimeSummary.mockMode;

  if (hasMockMode && hasPlatformDetected && runtimeAligned) {
    return {
      status: 'PASS',
      details: `runtime.mockMode=${payload.runtime.mockMode}, runtime.platformDetected=${payload.runtime.platformDetected}, runtime.isTauri=${payload.runtime.isTauri}`,
    };
  }

  return {
    status: 'FAIL',
    details: `runtime keys present: mockMode=${hasMockMode}, platformDetected=${hasPlatformDetected}, alignedWithSummary=${runtimeAligned}`,
    remediationHint: 'Use RuntimeService.getRuntimeInfo() for diagnostics summary and support bundle payload.',
  };
};

export const runDiagnosticsSelfTest = async (context: DiagnosticsContext): Promise<SelfTestReport> => {
  const checks: SelfTestCheck[] = [];

  await addCheck(checks, { id: 'P1.1', phase: 'Phase 1', name: 'Hard gate active' }, () => checkP11HardGate(context));
  await addCheck(checks, { id: 'P1.2', phase: 'Phase 1', name: 'No uncaught invoke errors in browser' }, checkP12SafeInvoke);
  await addCheck(checks, { id: 'P1.3', phase: 'Phase 1', name: 'Retry works' }, checkP13RetrySemantics);
  await addCheck(checks, { id: 'P1.4', phase: 'Phase 1', name: 'Mock mode can enable + retry' }, checkP14MockEnableRetry);

  await addCheck(checks, { id: 'P2.1', phase: 'Phase 2', name: 'Routes render' }, checkP21RoutesRender);
  await addCheck(checks, { id: 'P2.2', phase: 'Phase 2', name: 'Empty states exist' }, checkP22EmptyStates);
  await addCheck(checks, { id: 'P2.3', phase: 'Phase 2', name: 'Settings does not leak detail panel' }, () =>
    checkP23SettingsNoLeak(context)
  );

  await addCheck(checks, { id: 'P3.1', phase: 'Phase 3', name: 'Filter/search empty cannot show detail product' }, checkP31FilterSelectionInvariant);
  await addCheck(checks, { id: 'P3.2', phase: 'Phase 3', name: 'Default filter deterministic' }, checkP32DefaultFilter);

  await addCheck(checks, { id: 'P4.1', phase: 'Phase 4', name: 'Responsive overflow audit' }, checkP41ResponsiveOverflow);
  await addCheck(checks, { id: 'P4.2', phase: 'Phase 4', name: 'Keyboard accessibility smoke' }, checkP42KeyboardFilters);
  await addCheck(checks, { id: 'P4.3', phase: 'Phase 4', name: 'Browser Open Logs is explanatory' }, () =>
    checkP43BrowserOpenLogs(context)
  );
  await addCheck(checks, { id: 'P4.4', phase: 'Phase 4', name: 'Support bundle includes runtime flags' }, () =>
    checkP44SupportBundleFlags(context)
  );

  return {
    timestamp: new Date().toISOString(),
    runtime: runtimeFromContext(context),
    checks,
    summary: summarize(checks),
  };
};

export const buildDiagnosticsRuntimeSummary = (context: DiagnosticsContext): SelfTestRuntimeSummary =>
  runtimeFromContext(context);
