import { Button, Card, Chip, Progress } from '@antiphon/ui';
import { resolveProductStatus, type Product, type ReleaseManifest } from '@antiphon/core';
import type { ReactNode } from 'react';
import type { DownloadJob } from '@/state/hub-store';

interface ProductDetailPanelProps {
  product?: Product;
  emptyState: 'catalog-empty' | 'filtered-empty' | 'no-selection';
  release?: ReleaseManifest;
  installedVersion?: string;
  job?: DownloadJob;
  status?: ReturnType<typeof resolveProductStatus>;
  isMockMode: boolean;
  onInstall: () => void;
  onLaunch: () => void;
  onUninstall: () => void;
}

const actionLabel = (status?: ReturnType<typeof resolveProductStatus>) => {
  if (status === 'installed') return 'Launch';
  if (status === 'update-available') return 'Update';
  return 'Install';
};

const statusTone = (status?: ReturnType<typeof resolveProductStatus>) => {
  if (status === 'installed') return 'success';
  if (status === 'update-available') return 'warning';
  return 'neutral';
};

export const ProductDetailPanel = ({
  product,
  emptyState,
  release,
  installedVersion,
  status,
  job,
  isMockMode,
  onInstall,
  onLaunch,
  onUninstall,
}: ProductDetailPanelProps) => {
  const mockInstallTooltip = 'Mock mode — installs are disabled (UI validation only).';
  const mockSystemTooltip = 'Mock mode — system actions are disabled (UI validation only).';
  const withMockTooltip = (tooltip: string, button: ReactNode) => {
    if (!isMockMode) {
      return button;
    }
    return (
      <span className="hub-action-disabled-wrap" title={tooltip}>
        {button}
      </span>
    );
  };

  if (!product) {
    if (emptyState === 'filtered-empty') {
      return (
        <Card className="hub-detail-card">
          <h3>No products match your filters</h3>
          <p>Adjust search, filters, or sort to see products.</p>
        </Card>
      );
    }

    return (
      <Card className="hub-detail-card">
        <p>
          {emptyState === 'catalog-empty'
            ? 'Catalog is empty. No product details are available.'
            : 'Select a product to view details.'}
        </p>
      </Card>
    );
  }

  const currentStatus = status ?? 'not-installed';

  return (
    <Card className="hub-detail-card" elevated>
      <header className="hub-detail-card__header">
        <img src="/logos/Logo - transparent background.png" alt="Antiphon" className="hub-detail-card__logo" />
        <div>
          <h2>{product.name}</h2>
          <p>{product.tagline}</p>
        </div>
      </header>

      <p>{product.description}</p>

      <div className="hub-detail-card__status">
        <Chip tone={statusTone(currentStatus)}>{currentStatus.replace('-', ' ')}</Chip>
        <span>Installed: {installedVersion ?? 'No'}</span>
        <span>Latest: {release?.version ?? product.currentVersion}</span>
      </div>

      {job ? (
        <section className="hub-detail-card__job">
          <div className="hub-detail-card__job-title">
            <strong>{job.state}</strong>
            <span>
              {Math.round((job.downloadedBytes / Math.max(job.totalBytes, 1)) * 100)}% • {Math.round(job.speedBps / 1024)}
              KB/s
            </span>
          </div>
          <Progress value={(job.downloadedBytes / Math.max(job.totalBytes, 1)) * 100} />
          {job.errorCode ? <small>Error: {job.errorCode}</small> : null}
        </section>
      ) : null}

      <section className="hub-detail-card__actions">
        {currentStatus === 'installed' ? (
          <>
            {withMockTooltip(
              mockSystemTooltip,
              <Button variant={isMockMode ? 'secondary' : 'primary'} onClick={onLaunch} disabled={isMockMode}>
                {actionLabel(currentStatus)}
              </Button>
            )}
            {withMockTooltip(
              mockInstallTooltip,
              <Button variant="secondary" onClick={onInstall} disabled={isMockMode}>
                Check Update
              </Button>
            )}
            {withMockTooltip(
              mockSystemTooltip,
              <Button variant={isMockMode ? 'secondary' : 'danger'} onClick={onUninstall} disabled={isMockMode}>
                Uninstall
              </Button>
            )}
          </>
        ) : (
          withMockTooltip(
            mockInstallTooltip,
            <Button variant={isMockMode ? 'secondary' : 'primary'} onClick={onInstall} disabled={isMockMode}>
              {actionLabel(currentStatus)}
            </Button>
          )
        )}
      </section>

      {isMockMode ? <small className="hub-mock-note">Mock mode: no real installs or system changes.</small> : null}

      <section className="hub-detail-card__release">
        <h3>Release Notes</h3>
        <p>{release?.notes ?? 'No release notes available.'}</p>
      </section>
    </Card>
  );
};
