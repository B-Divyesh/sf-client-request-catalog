import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

test('private catalog is accessible and produces a quote-ready request', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/?client=demo-client');
  await expect(page).toHaveTitle(/Client Request Catalog/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveCount(1);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter(v => ['serious', 'critical'].includes(v.impact || '')).map(v => v.id)).toEqual([]);
  await page.locator('.add').first().click();
  await page.locator('input[name="name"]').fill('Jordan Example');
  await page.locator('input[name="email"]').fill('jordan@example.test');
  await page.locator('#request-form').getByRole('button', { name: /send request/i }).click();
  await expect(page.locator('#form-message')).toContainText(/Request CRC-0001 is in the inbox/);
  expect(errors).toEqual([]);
});
