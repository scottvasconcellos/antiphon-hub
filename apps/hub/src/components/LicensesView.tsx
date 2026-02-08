import { useMemo, useState } from 'react';
import { Button, Card, Input } from '@antiphon/ui';
import type { Product } from '@antiphon/core';
import { isSerialFormatValid } from '@/services/licensing/serial';

interface LicensesViewProps {
  products: Product[];
  serialInput: string;
  serialProductId: string;
  onSerialInput: (value: string) => void;
  onSerialProduct: (value: string) => void;
  onActivate: () => void;
  onExportOfflineRequest: () => void;
  onImportOfflineResponse: () => void;
}

export const LicensesView = ({
  products,
  serialInput,
  serialProductId,
  onSerialInput,
  onSerialProduct,
  onActivate,
  onExportOfflineRequest,
  onImportOfflineResponse,
}: LicensesViewProps) => {
  const [serialError, setSerialError] = useState<string | undefined>();
  const hasProducts = products.length > 0;

  const selectedProductId = useMemo(() => {
    if (!hasProducts) {
      return '';
    }
    const match = products.find((product) => product.id === serialProductId);
    return match ? serialProductId : (products[0]?.id ?? '');
  }, [hasProducts, products, serialProductId]);

  const handleActivate = () => {
    if (!isSerialFormatValid(serialInput)) {
      setSerialError('Enter a valid serial (8+ characters, letters/numbers/dashes).');
      return;
    }
    setSerialError(undefined);
    onActivate();
  };

  return (
    <Card className="hub-licenses" elevated>
      <h2>Licenses</h2>
      <p>Perpetual license activation with optional offline flow.</p>

      <div className="hub-licenses__row">
        <label htmlFor="license-product">Product</label>
        <select
          id="license-product"
          value={selectedProductId}
          onChange={(event) => onSerialProduct(event.target.value)}
          disabled={!hasProducts}
        >
          {!hasProducts ? <option value="">No products available</option> : null}
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </div>

      <Input
        label="Serial"
        value={serialInput}
        error={serialError}
        onChange={(event) => {
          setSerialError(undefined);
          onSerialInput(event.target.value);
        }}
        onBlur={() => {
          if (!serialInput.trim()) {
            setSerialError(undefined);
            return;
          }
          if (!isSerialFormatValid(serialInput)) {
            setSerialError('Enter a valid serial (8+ characters, letters/numbers/dashes).');
          } else {
            setSerialError(undefined);
          }
        }}
        placeholder="XXXX-XXXX-XXXX"
      />

      <div className="hub-licenses__actions">
        <Button variant="primary" onClick={handleActivate} disabled={!hasProducts}>
          Activate Serial
        </Button>
        <Button variant="secondary" onClick={onExportOfflineRequest}>
          Export Offline Request
        </Button>
        <Button variant="secondary" onClick={onImportOfflineResponse}>
          Import Offline Response
        </Button>
      </div>
    </Card>
  );
};
