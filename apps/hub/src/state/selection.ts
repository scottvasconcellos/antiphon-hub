import type { Product } from '@antiphon/core';

export const reconcileSelectedProductId = (
  products: Product[],
  preferredSelection?: string
): string | undefined => {
  if (products.length === 0) {
    return undefined;
  }
  if (preferredSelection && products.some((product) => product.id === preferredSelection)) {
    return preferredSelection;
  }
  return products[0]?.id;
};
