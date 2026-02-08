import { beforeEach, describe, expect, it } from 'vitest';
import { isMockModeEnabled, isTauri, safeInvoke, setMockModeEnabled } from '@/services/platform/tauri';

describe('platform tauri wrapper', () => {
  beforeEach(() => {
    localStorage.clear();
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it('detects non-tauri runtime by default', () => {
    expect(isTauri()).toBe(false);
  });

  it('detects tauri runtime when internals are present', () => {
    (window as Window & { __TAURI_INTERNALS__?: { invoke: () => void } }).__TAURI_INTERNALS__ = {
      invoke: () => undefined,
    };

    expect(isTauri()).toBe(true);
  });

  it('fails safeInvoke with controlled TAURI_UNAVAILABLE error when bridge is missing', async () => {
    await expect(safeInvoke('current_platform')).rejects.toMatchObject({
      code: 'TAURI_UNAVAILABLE',
    });
  });

  it('uses mock invoke when mock mode is enabled in dev', async () => {
    setMockModeEnabled(true);
    expect(isMockModeEnabled()).toBe(true);
    const platform = await safeInvoke<{ os: string; arch: string }>('current_platform');
    expect(platform).toHaveProperty('os');
    expect(platform).toHaveProperty('arch');
  });

  it('blocks privileged commands in mock mode', async () => {
    setMockModeEnabled(true);
    await expect(
      safeInvoke('download_and_install', {
        request: {
          productId: 'antiphon-dummy-product',
          version: '1.0.0',
        },
      })
    ).rejects.toMatchObject({
      code: 'MOCK_MODE_BLOCKED',
    });
  });
});
