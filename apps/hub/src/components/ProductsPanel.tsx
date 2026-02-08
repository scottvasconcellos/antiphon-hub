import { useEffect, useRef, useState } from 'react';
import { cardEntranceVariant, itemStagger, staggerContainer } from '@antiphon/motion';
import { Card, Chip, Table } from '@antiphon/ui';
import { AnimatePresence, motion } from 'framer-motion';
import { resolveProductStatus, type Product } from '@antiphon/core';
import type { ProductFilter, ProductSort, ProductViewMode } from '@/state/hub-store';

export interface ProductsPanelProps {
  products: Product[];
  catalogIsEmpty: boolean;
  releasesVersionMap: Record<string, string>;
  statusByProduct: Record<string, ReturnType<typeof resolveProductStatus>>;
  search: string;
  viewMode: ProductViewMode;
  filter: ProductFilter;
  sort: ProductSort;
  compactFilters: boolean;
  collapseListToCards: boolean;
  onSelectProduct: (id: string) => void;
  onSetViewMode: (mode: ProductViewMode) => void;
  onSetFilter: (filter: ProductFilter) => void;
  onSetSort: (sort: ProductSort) => void;
  onSearch: (query: string) => void;
  selectedProductId?: string;
}

const statusTone = (status: ReturnType<typeof resolveProductStatus>) => {
  if (status === 'installed') return 'success';
  if (status === 'update-available') return 'warning';
  return 'neutral';
};

const statusLabel = (status: ReturnType<typeof resolveProductStatus>) => {
  if (status === 'installed') return 'Installed';
  if (status === 'update-available') return 'Update available';
  return 'Not installed';
};

const filterOptions = ['all', 'installed', 'updates', 'not-installed'] as const;

export const ProductsPanel = ({
  products,
  catalogIsEmpty,
  releasesVersionMap,
  statusByProduct,
  search,
  viewMode,
  filter,
  sort,
  compactFilters,
  collapseListToCards,
  onSelectProduct,
  onSetViewMode,
  onSetFilter,
  onSetSort,
  onSearch,
  selectedProductId,
}: ProductsPanelProps) => {
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterTriggerRef = useRef<HTMLButtonElement | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const filterMenuId = 'hub-filter-menu';
  const activeFilterLabel = filter === 'all' ? 'All' : filter.replace('-', ' ');

  useEffect(() => {
    if (!compactFilters) {
      setIsFilterMenuOpen(false);
    }
  }, [compactFilters]);

  useEffect(() => {
    if (!isFilterMenuOpen) {
      return;
    }

    const firstButton = filterMenuRef.current?.querySelector<HTMLButtonElement>('button');
    firstButton?.focus();

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !filterMenuRef.current?.contains(target) &&
        !filterTriggerRef.current?.contains(target)
      ) {
        setIsFilterMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsFilterMenuOpen(false);
        filterTriggerRef.current?.focus();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusables = Array.from(filterMenuRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
      if (focusables.length === 0) {
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) {
        return;
      }
      const active = document.activeElement;

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFilterMenuOpen]);

  const renderFilterButtons = (inMenu: boolean) =>
    filterOptions.map((option) => (
      <button
        key={option}
        type="button"
        role={inMenu ? 'menuitemradio' : undefined}
        aria-checked={inMenu ? filter === option : undefined}
        className={filter === option ? 'is-active' : ''}
        onClick={() => {
          onSetFilter(option);
          if (inMenu) {
            setIsFilterMenuOpen(false);
            filterTriggerRef.current?.focus();
          }
        }}
      >
        {option.replace('-', ' ')}
      </button>
    ));

  return (
    <section className="hub-products-panel">
      <header className="hub-products-toolbar">
        <div className="hub-products-toolbar__group">
          <button
            type="button"
            className={viewMode === 'gallery' ? 'is-active' : ''}
            onClick={() => onSetViewMode('gallery')}
          >
            Gallery
          </button>
          <button
            type="button"
            className={viewMode === 'list' ? 'is-active' : ''}
            onClick={() => onSetViewMode('list')}
          >
            List
          </button>
        </div>

        <div className="hub-products-toolbar__group">
          {!compactFilters ? renderFilterButtons(false) : null}

          {compactFilters ? (
            <div className="hub-more-filters">
              <button
                ref={filterTriggerRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={isFilterMenuOpen}
                aria-controls={filterMenuId}
                onClick={() => setIsFilterMenuOpen((open) => !open)}
                className="hub-more-filters__trigger"
              >
                Filters: {activeFilterLabel}
              </button>

              {isFilterMenuOpen ? (
                <div className="hub-more-filters__menu" id={filterMenuId} role="menu" ref={filterMenuRef}>
                  {renderFilterButtons(true)}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="hub-products-toolbar__group hub-products-toolbar__grow">
          <input
            type="search"
            placeholder="Search products"
            className="hub-search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
          />
          <select value={sort} onChange={(event) => onSetSort(event.target.value as ProductSort)}>
            <option value="name">Name</option>
            <option value="recently-updated">Recently updated</option>
            <option value="installed-date">Installed date</option>
          </select>
        </div>
      </header>

      {products.length === 0 ? (
        <section className="hub-empty-state">
          {catalogIsEmpty ? (
            <>
              <h3>No products available yet</h3>
              <p>Catalog returned no entries. Check connectivity or local catalog fallback configuration.</p>
            </>
          ) : (
            <>
              <h3>No products match current filters</h3>
              <p>Adjust search, filters, or sort to view available products.</p>
            </>
          )}
        </section>
      ) : null}

      {products.length > 0 && viewMode === 'gallery' ? (
        <motion.div className="hub-grid" variants={staggerContainer} initial="hidden" animate="visible" layout>
          <AnimatePresence mode="popLayout">
            {products.map((product) => {
              const status = statusByProduct[product.id] ?? 'not-installed';
              return (
                <motion.button
                  key={product.id}
                  className={`hub-grid__item ${selectedProductId === product.id ? 'is-selected' : ''}`}
                  variants={itemStagger}
                  layout
                  onClick={() => onSelectProduct(product.id)}
                >
                  <Card className="hub-product-card" elevated>
                    <motion.div variants={cardEntranceVariant} initial="hidden" animate="visible" exit="exit">
                      <img src="/logos/Logo - transparent background.png" alt="Antiphon" className="hub-product-card__logo" />
                      <h3>{product.name}</h3>
                      <p>{product.tagline}</p>
                      <div className="hub-product-card__meta">
                        <Chip tone={statusTone(status)}>{statusLabel(status)}</Chip>
                        <span>v{releasesVersionMap[product.id] ?? product.currentVersion}</span>
                      </div>
                    </motion.div>
                  </Card>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </motion.div>
      ) : null}

      {products.length > 0 && viewMode === 'list' && !collapseListToCards ? (
        <Table
          columns={[
            { key: 'name', header: 'Product', cell: (product: Product) => product.name },
            { key: 'tagline', header: 'Tagline', cell: (product: Product) => product.tagline },
            {
              key: 'version',
              header: 'Version',
              cell: (product: Product) => releasesVersionMap[product.id] ?? product.currentVersion,
            },
            {
              key: 'status',
              header: 'Status',
              cell: (product: Product) => (
                <Chip tone={statusTone(statusByProduct[product.id] ?? 'not-installed')}>
                  {statusLabel(statusByProduct[product.id] ?? 'not-installed')}
                </Chip>
              ),
            },
          ]}
          rows={products}
          rowKey={(product) => product.id}
        />
      ) : null}

      {products.length > 0 && viewMode === 'list' && collapseListToCards ? (
        <div className="hub-list-cards">
          {products.map((product) => {
            const status = statusByProduct[product.id] ?? 'not-installed';
            return (
              <button
                key={product.id}
                type="button"
                className={`hub-list-card ${selectedProductId === product.id ? 'is-selected' : ''}`}
                onClick={() => onSelectProduct(product.id)}
              >
                <strong>{product.name}</strong>
                <span>{product.tagline}</span>
                <div className="hub-list-card__meta">
                  <Chip tone={statusTone(status)}>{statusLabel(status)}</Chip>
                  <small>v{releasesVersionMap[product.id] ?? product.currentVersion}</small>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
};
