import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '@/App';
import { useHubStore } from '@/state/hub-store';

describe('Products selection reconciliation', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('antiphon:mock-mode', '1');
    useHubStore.setState({
      nav: 'products',
      filter: 'all',
      sort: 'name',
      search: '',
      runtimeError: undefined,
      toast: undefined,
    });
  });

  it('clears detail selection when filters produce no visible results', async () => {
    render(<App />);

    await screen.findByRole('heading', { name: 'Antiphon Hub' });
    const search = screen.getByPlaceholderText('Search products');

    fireEvent.change(search, { target: { value: '__no_match__' } });

    expect(await screen.findByText('No products match current filters')).toBeInTheDocument();
    expect(screen.getByText('No products match your filters')).toBeInTheDocument();
    expect(screen.getByText('Adjust search, filters, or sort to see products.')).toBeInTheDocument();

    await waitFor(() => {
      expect(useHubStore.getState().selectedProductId).toBeUndefined();
    });

    fireEvent.change(search, { target: { value: '' } });

    await waitFor(() => {
      expect(useHubStore.getState().selectedProductId).toBeDefined();
    });
  });

  it('resets products defaults on mount for deterministic filter state', async () => {
    useHubStore.setState({
      filter: 'not-installed',
      sort: 'installed-date',
      search: 'stale',
    });

    render(<App />);
    await screen.findByRole('heading', { name: 'Antiphon Hub' });

    const store = useHubStore.getState();
    expect(store.filter).toBe('all');
    expect(store.sort).toBe('name');
    expect(store.search).toBe('');
    expect(screen.getByRole('button', { name: 'all' })).toHaveClass('is-active');
    expect(screen.getByPlaceholderText('Search products')).toHaveValue('');
  });

  it('shows install as disabled with mock mode tooltip', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Antiphon Hub' });

    const installButton = screen.getByRole('button', { name: 'Install' });
    expect(installButton).toBeDisabled();
    expect(installButton.closest('.hub-action-disabled-wrap')).toHaveAttribute(
      'title',
      'Mock mode — installs are disabled (UI validation only).'
    );
  });
});

