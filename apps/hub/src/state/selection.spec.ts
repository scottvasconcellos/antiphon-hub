import { describe, expect, it } from 'vitest';
import type { Product } from '@antiphon/core';
import { reconcileSelectedProductId } from '@/state/selection';

const productA: Product = {
  id: 'a',
  name: 'A',
  tagline: 'A',
  description: 'A',
  category: 'utilities',
  currentVersion: '1.0.0',
  releaseChannel: 'stable',
  purchase: { type: 'serial', supportsOffline: true },
  licensePolicy: { seats: 1, offlineGraceDays: 7, requiresAccount: false },
  platforms: [],
};

const productB: Product = {
  ...productA,
  id: 'b',
  name: 'B',
};

describe('reconcileSelectedProductId', () => {
  it('clears selection when catalog is empty', () => {
    expect(reconcileSelectedProductId([], 'a')).toBeUndefined();
  });

  it('preserves selection when selected product exists', () => {
    expect(reconcileSelectedProductId([productA, productB], 'b')).toBe('b');
  });

  it('falls back to first product when preferred selection is missing', () => {
    expect(reconcileSelectedProductId([productA, productB], 'missing')).toBe('a');
  });
});
