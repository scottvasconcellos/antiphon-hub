import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import type { Product } from '@antiphon/core';
import { LicensesView } from '@/components/LicensesView';

const sampleProducts: Product[] = [
  {
    id: 'antiphon-dummy-product',
    name: 'Antiphon Dummy Product',
    tagline: 'Mock product',
    description: 'Test catalog item',
    category: 'utilities',
    currentVersion: '1.0.0',
    releaseChannel: 'stable',
    purchase: { type: 'serial', supportsOffline: true },
    licensePolicy: { seats: 2, offlineGraceDays: 14, requiresAccount: false },
    platforms: [],
  },
];

describe('LicensesView serial validation scope', () => {
  it('does not validate serial format on initial render', () => {
    render(
      <LicensesView
        products={sampleProducts}
        serialInput=""
        serialProductId="antiphon-dummy-product"
        onSerialInput={() => undefined}
        onSerialProduct={() => undefined}
        onActivate={() => undefined}
        onExportOfflineRequest={() => undefined}
        onImportOfflineResponse={() => undefined}
      />
    );

    expect(screen.queryByText('Enter a valid serial (8+ characters, letters/numbers/dashes).')).not.toBeInTheDocument();
  });

  it('validates only when activation is submitted', () => {
    const onActivate = vi.fn();

    const Harness = () => {
      const [serialInput, setSerialInput] = useState('');
      return (
        <LicensesView
          products={sampleProducts}
          serialInput={serialInput}
          serialProductId="antiphon-dummy-product"
          onSerialInput={setSerialInput}
          onSerialProduct={() => undefined}
          onActivate={onActivate}
          onExportOfflineRequest={() => undefined}
          onImportOfflineResponse={() => undefined}
        />
      );
    };

    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Activate Serial' }));
    expect(onActivate).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a valid serial (8+ characters, letters/numbers/dashes).')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('XXXX-XXXX-XXXX'), { target: { value: 'ABCD-1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Activate Serial' }));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });
});
