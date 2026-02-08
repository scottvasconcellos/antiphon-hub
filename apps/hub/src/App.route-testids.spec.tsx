import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '@/App';
import { useHubStore } from '@/state/hub-store';

describe('Route test ids', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('antiphon:mock-mode', '1');
    useHubStore.setState({
      nav: 'products',
      runtimeError: undefined,
      toast: undefined,
      search: '',
      filter: 'all',
      sort: 'name',
      viewMode: 'gallery',
    });
    window.history.replaceState({}, '', '/?diag=1');
  });

  it('renders stable route markers for workflow and diagnostics routes', async () => {
    render(<App />);

    await screen.findByRole('heading', { name: 'Antiphon Hub' });
    expect(screen.getByTestId('route-products')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Installed' }));
    expect(await screen.findByTestId('route-installed')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Updates' }));
    expect(await screen.findByTestId('route-updates')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Licenses' }));
    expect(await screen.findByTestId('route-licenses')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    expect(await screen.findByTestId('route-account')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(await screen.findByTestId('route-settings')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Diagnostics' }));
    expect(await screen.findByTestId('route-diagnostics')).toBeInTheDocument();
  });
});
