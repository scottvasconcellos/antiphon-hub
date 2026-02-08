import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '@/App';
import { useHubStore } from '@/state/hub-store';

describe('Settings route isolation', () => {
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
  });

  it('does not render the product detail panel in settings view', async () => {
    render(<App />);

    await screen.findByRole('heading', { name: 'Antiphon Hub' });

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Release Notes' })).not.toBeInTheDocument();
    expect(screen.queryByText('Select a product to view details.')).not.toBeInTheDocument();
    const verifyButton = screen.getByRole('button', { name: 'Verify installed apps' });
    expect(verifyButton).toBeInTheDocument();
    expect(verifyButton.tagName).toBe('BUTTON');
    fireEvent.click(verifyButton);
    expect(await screen.findByText('Mock mode: verify installed apps is unavailable.')).toBeInTheDocument();
    expect(screen.queryByText('SERIAL_FORMAT_INVALID')).not.toBeInTheDocument();
    expect(screen.queryByText('Invalid serial format')).not.toBeInTheDocument();
  });
});
