import { test, expect } from '@playwright/test';

test('hub loads in mock mode (ready root)', async ({ page }) => {
  await page.goto('/');

  // If your app supports mock mode via query param, use that.
  // Otherwise this test falls back to clicking the Mock button.
  await page.goto('/?mock=1').catch(() => {});

  const mockButton = page.getByRole('button', { name: /mock/i }).first();
  if (await mockButton.isVisible().catch(() => false)) {
    await mockButton.click();
  }

  await expect(page.getByTestId('hub-ready-root')).toBeVisible({ timeout: 60_000 });
});
