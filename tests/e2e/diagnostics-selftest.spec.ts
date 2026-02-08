import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test('run diagnostics self-test and download JSON report', async ({ page }) => {
  // Boot in mock mode (works in browser dev server)
  await page.goto('/?mock=1');

  // Wait for app "ready"
  await expect(page.getByTestId('hub-ready-root')).toBeVisible({ timeout: 60_000 });

  // Go to Diagnostics (top nav)
  await page.getByRole('link', { name: /diagnostics/i }).click();

  // Click Run self-test (exact label in your UI)
  const runBtn = page.getByRole('button', { name: /^Run self-test$/i });
  await runBtn.scrollIntoViewIfNeeded();
  await expect(runBtn).toBeVisible({ timeout: 30_000 });
  await runBtn.click();

  // Wait until the Export JSON button is usable, then download it
  const exportBtn = page.getByRole('button', { name: /Export Self-Test Report \(JSON\)/i });
  await exportBtn.scrollIntoViewIfNeeded();
  await expect(exportBtn).toBeEnabled({ timeout: 120_000 });

  const downloadPromise = page.waitForEvent('download', { timeout: 120_000 });
  await exportBtn.click();
  const dl = await downloadPromise;

  fs.mkdirSync('test-results/selftest', { recursive: true });
  const outPath = path.join('test-results/selftest', 'report.json');
  await dl.saveAs(outPath);

  // Print where it went
  console.log('Saved:', outPath);
});
