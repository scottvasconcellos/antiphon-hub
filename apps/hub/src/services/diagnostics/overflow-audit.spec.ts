import { describe, expect, it } from 'vitest';
import { describeOverflowCulprits } from '@/services/diagnostics/DiagnosticsService';

const rect = (left: number, width: number): DOMRect =>
  ({
    x: left,
    y: 0,
    top: 0,
    left,
    right: left + width,
    bottom: 100,
    width,
    height: 100,
    toJSON: () => ({}),
  }) as DOMRect;

describe('overflow audit helper', () => {
  it('lists selector paths for overflowing elements', () => {
    const viewport = document.createElement('div');
    document.body.appendChild(viewport);

    Object.defineProperty(viewport, 'clientWidth', { value: 480, configurable: true });
    viewport.getBoundingClientRect = () => rect(0, 480);

    const ok = document.createElement('div');
    ok.className = 'safe';
    ok.getBoundingClientRect = () => rect(0, 300);
    viewport.appendChild(ok);

    const bad = document.createElement('div');
    bad.className = 'offender';
    bad.getBoundingClientRect = () => rect(0, 560);
    viewport.appendChild(bad);

    const culprits = describeOverflowCulprits(viewport, { viewportWidth: 480, limit: 2 });
    expect(culprits.length).toBeGreaterThan(0);
    expect(culprits[0]?.selectorPath).toContain('.offender');
    expect(culprits[0]?.severity).toBeGreaterThan(0);

    viewport.remove();
  });
});
