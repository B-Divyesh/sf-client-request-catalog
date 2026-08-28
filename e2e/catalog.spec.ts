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

test('SPA fallback, keyboard, mobile, privacy, and offline states work', async ({ page }) => {
  const privacyResponse = await page.goto('/privacy');
  expect(privacyResponse?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: /your request stays a request/i })).toBeVisible();
  const remoteResources = await page.evaluate(() => performance.getEntriesByType('resource')
    .map(entry => entry.name)
    .filter(url => new URL(url).origin !== location.origin));
  expect(remoteResources).toEqual([]);

  await page.goto('/?client=demo-client');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await expect(page.locator('.skip-link')).toBeVisible();
  await page.locator('.add').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#count')).toHaveText('1');

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator('.mast').evaluate(element =>
    getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length
  )).toBe(1);
  await expect(page.locator('.request-slip')).toBeVisible();

  await page.context().setOffline(true);
  await page.locator('input[name="name"]').fill('Offline Jordan');
  await page.locator('input[name="email"]').fill('offline@example.test');
  await page.locator('#request-form').getByRole('button', { name: /send request/i }).click();
  await expect(page.locator('#form-message')).toContainText(/offline/i);
  await page.context().setOffline(false);
});
