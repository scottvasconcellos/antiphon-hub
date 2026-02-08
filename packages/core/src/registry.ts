import type { InstalledProductRecord, Product, ReleaseManifest } from './types';

export type ProductComputedStatus = 'installed' | 'update-available' | 'not-installed';

export const resolveProductStatus = (
  product: Product,
  installedRegistry: Record<string, InstalledProductRecord>,
  releaseManifest?: ReleaseManifest
): ProductComputedStatus => {
  const installed = installedRegistry[product.id];
  if (!installed) {
    return 'not-installed';
  }
  if (releaseManifest && installed.installedVersion !== releaseManifest.version) {
    return 'update-available';
  }
  return 'installed';
};
