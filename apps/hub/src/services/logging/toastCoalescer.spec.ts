import { describe, expect, it, vi } from 'vitest';
import { createToastCoalescer } from '@/services/logging/toastCoalescer';

describe('toast coalescer', () => {
  it('coalesces rapid updates into one toast', () => {
    vi.useFakeTimers();

    const shown: string[] = [];
    const hidden: number[] = [];
    const coalescer = createToastCoalescer({
      delayMs: 300,
      ttlMs: 1000,
      onShow: (toast) => {
        shown.push(toast.message);
      },
      onHide: () => {
        hidden.push(Date.now());
      },
    });

    coalescer.enqueue('Settings saved');
    coalescer.enqueue('Settings saved');

    vi.advanceTimersByTime(299);
    expect(shown).toHaveLength(0);

    vi.advanceTimersByTime(1);
    expect(shown).toEqual(['Settings saved']);

    vi.advanceTimersByTime(1000);
    expect(hidden).toHaveLength(1);

    vi.useRealTimers();
  });
});
