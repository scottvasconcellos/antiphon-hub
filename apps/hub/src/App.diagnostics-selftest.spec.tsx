import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '@/App';
import { useHubStore } from '@/state/hub-store';

describe('Diagnostics self-test report', () => {
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

  it('runs self-test and reports zero FAIL checks in browser mock mode', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Antiphon Hub' });

    fireEvent.click(screen.getByRole('button', { name: 'Diagnostics' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Run Self-Test' }));

    await waitFor(() => {
      expect(screen.getByText('FAIL: 0')).toBeInTheDocument();
    });
  });
});
