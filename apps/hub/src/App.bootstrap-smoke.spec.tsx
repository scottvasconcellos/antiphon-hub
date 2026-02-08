import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '@/App';

describe('App bootstrap gating smoke', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows a blocking startup failure screen in non-tauri runtime', async () => {
    render(<App />);

    expect(await screen.findByText('Hub startup failed')).toBeInTheDocument();
    expect(
      screen.getByText('This Hub runs as a desktop app. You are viewing the web dev server without the desktop bridge.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Install, update, license, and launch Antiphon products.')).not.toBeInTheDocument();
  });

  it('enables mock mode from failure screen and boots successfully', async () => {
    render(<App />);

    const mockModeButton = await screen.findByRole('button', {
      name: 'Enable Mock Mode (dev)',
    });
    fireEvent.click(mockModeButton);

    expect(await screen.findByRole('heading', { name: 'Antiphon Hub' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Hub startup failed')).not.toBeInTheDocument();
    });
  });

  it('keeps mock mode indicator across navigation and remount', async () => {
    localStorage.setItem('antiphon:mock-mode', '1');
    const view = render(<App />);

    await screen.findByRole('heading', { name: 'Antiphon Hub' });
    expect(
      screen.getByText('Running in mock mode - UI validation only. No real installs or system changes.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(
      screen.getByText('Running in mock mode - UI validation only. No real installs or system changes.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Products' }));
    expect(
      screen.getByText('Running in mock mode - UI validation only. No real installs or system changes.')
    ).toBeInTheDocument();

    view.unmount();

    render(<App />);
    await screen.findByRole('heading', { name: 'Antiphon Hub' });
    expect(
      screen.getByText('Running in mock mode - UI validation only. No real installs or system changes.')
    ).toBeInTheDocument();
  });
});
