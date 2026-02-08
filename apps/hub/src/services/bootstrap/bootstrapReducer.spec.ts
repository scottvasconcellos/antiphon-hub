import { describe, expect, it } from 'vitest';
import { bootstrapReducer, initialBootstrapState } from '@/services/bootstrap/bootstrapReducer';

describe('bootstrap reducer', () => {
  it('transitions to booting on start', () => {
    const next = bootstrapReducer(initialBootstrapState, { type: 'BOOT_START' });
    expect(next.status).toBe('booting');
  });

  it('tracks boot step labels', () => {
    const started = bootstrapReducer(initialBootstrapState, { type: 'BOOT_START' });
    const step = bootstrapReducer(started, { type: 'BOOT_STEP', stepLabel: 'Loading catalog…' });
    expect(step.stepLabel).toBe('Loading catalog…');
  });

  it('transitions to ready state', () => {
    const ready = bootstrapReducer(initialBootstrapState, { type: 'BOOT_READY', runtimeMode: 'tauri' });
    expect(ready.status).toBe('ready');
    expect(ready.runtimeMode).toBe('tauri');
  });

  it('transitions to failed with error', () => {
    const failed = bootstrapReducer(initialBootstrapState, {
      type: 'BOOT_FAILED',
      error: {
        code: 'TAURI_UNAVAILABLE',
        userMessage: 'Desktop bridge missing',
      },
    });

    expect(failed.status).toBe('failed');
    expect(failed.error?.code).toBe('TAURI_UNAVAILABLE');
  });
});
