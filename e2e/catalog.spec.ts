import { test, expect, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

const ownerHeaders = { 'x-owner-code': 'e2e-owner-code-12345', 'x-forwarded-for': '198.51.100.200' };
const clientIp = async (page: Page, suffix: number) => page.setExtraHTTPHeaders({ 'x-forwarded-for': `198.51.100.${suffix}` });

test('@claim:demo-isolated sample requests never enter the real inbox', async ({ page, request }) => {
  await clientIp(page, 11);
  const before = await request.get('/api/admin/overview', { headers: ownerHeaders });
  const beforeCount = ((await before.json()).requests as unknown[]).length;
  const requestedPaths: string[] = [];
  page.on('request', item => requestedPaths.push(new URL(item.url()).pathname));

  await page.goto('/demo');
  await expect(page.getByText('Demo — sample data, nothing is saved')).toBeVisible();
  await page.locator('.add').first().click();
  await page.locator('input[name="name"]').fill('Jordan Example');
  await page.locator('input[name="email"]').fill('jordan@example.test');
  await page.getByRole('button', { name: /send request/i }).click();
  await expect(page.locator('#form-message')).toContainText('Nothing was saved');
  expect(requestedPaths).toContain('/api/demo/catalog');
  expect(requestedPaths).toContain('/api/demo/requests');
  expect(requestedPaths.some(value => value.startsWith('/api/catalog/'))).toBe(false);

  const after = await request.get('/api/admin/overview', { headers: ownerHeaders });
  expect(((await after.json()).requests as unknown[]).length).toBe(beforeCount);
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.locator('#count')).toHaveText('0');
  await expect(page.getByRole('link', { name: 'Start for real' })).toHaveAttribute('href', '/');
});

test('@claim:private-prices root hides prices and owners control opaque links', async ({ page, request }) => {
  await clientIp(page, 12);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Create private catalogs for repeat clients' })).toBeVisible();
  await expect(page.locator('.offer')).toHaveCount(0);
  await expect(page.getByText('$185.00')).toHaveCount(0);
  expect((await request.get('/api/catalog/demo-client', { headers: { 'x-forwarded-for': '198.51.100.201' } })).status()).toBe(410);

  const created = await request.post('/api/admin/clients', {
    headers: ownerHeaders,
    data: { name: 'Regression Client', expires_in_days: 30 }
  });
  expect(created.status()).toBe(200);
  const link = await created.json() as { id: number; token: string };
  expect(link.token).toMatch(/^[A-Za-z0-9]{40}$/);
  const catalog = await request.get(`/api/catalog/${link.token}`, { headers: { 'x-forwarded-for': '198.51.100.202' } });
  expect(catalog.status()).toBe(200);
  expect(typeof (await catalog.json()).products[0].price_cents).toBe('number');
  expect((await request.delete(`/api/admin/clients/${link.id}`, { headers: ownerHeaders })).status()).toBe(200);
  expect((await request.get(`/api/catalog/${link.token}`, { headers: { 'x-forwarded-for': '198.51.100.203' } })).status()).toBe(410);
});

test('@claim:request-inbox a valid private request reaches the owner inbox', async ({ page, request }) => {
  await clientIp(page, 13);
  const created = await request.post('/api/admin/clients', { headers: ownerHeaders, data: { name: 'North Street', expires_in_days: 30 } });
  const { token } = await created.json() as { token: string };
  await page.goto(`/?client=${token}`);
  await expect(page.getByText('Avery at North Street')).toHaveCount(0);
  await page.locator('.add').first().click();
  await page.locator('input[name="name"]').fill('Taylor Requester');
  await page.locator('input[name="email"]').fill('taylor@example.test');
  await page.getByRole('button', { name: /send request/i }).click();
  await expect(page.locator('#form-message')).toContainText(/Request CRC-\d{6} is in the inbox/);
  const overview = await request.get('/api/admin/overview', { headers: ownerHeaders });
  expect((await overview.json()).requests.some((entry: { email: string }) => entry.email === 'taylor@example.test')).toBe(true);
});

test('@claim:owner-exports owner exports contain saved requests', async ({ request }) => {
  const csv = await request.get('/api/admin/requests.csv', { headers: ownerHeaders });
  expect(csv.status()).toBe(200);
  expect(csv.headers()['content-type']).toContain('text/csv');
  expect(await csv.text()).toContain('reference,name,email,status,created_at,items,note');
  const pdf = await request.get('/api/admin/requests.pdf', { headers: ownerHeaders });
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toContain('application/pdf');
  expect(new TextDecoder().decode((await pdf.body()).subarray(0, 8))).toBe('%PDF-1.4');
});

test('@claim:client-offer-visibility owners assign a different private offer list to each client', async ({ page, request }) => {
  const headers = { 'x-owner-code': 'e2e-owner-code-12345', 'x-forwarded-for': '198.51.100.211' };
  const alpha = await request.post('/api/admin/clients', { headers, data: { name: 'Client Alpha', expires_in_days: 30, offer_ids: [1] } });
  const beta = await request.post('/api/admin/clients', { headers, data: { name: 'Client Beta', expires_in_days: 30, offer_ids: [2] } });
  expect(alpha.status()).toBe(200);
  expect(beta.status()).toBe(200);
  const alphaLink = await alpha.json() as { id: number; token: string };
  const betaLink = await beta.json() as { id: number; token: string };

  const [alphaCatalog, betaCatalog] = await Promise.all([
    request.get(`/api/catalog/${alphaLink.token}`, { headers: { 'x-forwarded-for': '198.51.100.212' } }),
    request.get(`/api/catalog/${betaLink.token}`, { headers: { 'x-forwarded-for': '198.51.100.213' } })
  ]);
  expect((await alphaCatalog.json()).products.map((product: { id: number }) => product.id)).toEqual([1]);
  expect((await betaCatalog.json()).products.map((product: { id: number }) => product.id)).toEqual([2]);

  await clientIp(page, 32);
  await page.goto('/owner');
  await page.locator('#owner-code').fill('e2e-owner-code-12345');
  await page.getByRole('button', { name: 'Open inbox' }).click();
  const alphaForm = page.locator(`.offer-assignment-form[data-client="${alphaLink.id}"]`);
  await expect(alphaForm.getByRole('group', { name: 'Offers visible to Client Alpha' })).toBeVisible();
  await alphaForm.locator('input[value="1"]').uncheck();
  await alphaForm.locator('input[value="3"]').check();
  await alphaForm.getByRole('button', { name: 'Save visible offers' }).click();
  await expect(alphaForm.locator('.form-message')).toHaveText('Visible offers saved.');
  await expect.poll(async () => {
    const catalog = await request.get(`/api/catalog/${alphaLink.token}`, { headers: { 'x-forwarded-for': '198.51.100.214' } });
    return (await catalog.json()).products.map((product: { id: number }) => product.id);
  }).toEqual([3]);
  const betaAfter = await request.get(`/api/catalog/${betaLink.token}`, { headers: { 'x-forwarded-for': '198.51.100.215' } });
  expect((await betaAfter.json()).products.map((product: { id: number }) => product.id)).toEqual([2]);
});

test('@claim:individual-request-privacy owner exports and deletes only the selected request', async ({ page, request }) => {
  const headers = { 'x-owner-code': 'e2e-owner-code-12345', 'x-forwarded-for': '198.51.100.216' };
  const created = await request.post('/api/admin/clients', { headers, data: { name: 'Privacy request client', expires_in_days: 30, offer_ids: [1] } });
  expect(created.status()).toBe(200);
  const link = await created.json() as { token: string };
  const submit = async (name: string, email: string) => request.post(`/api/catalog/${link.token}/requests`, {
    headers: { 'x-forwarded-for': `198.51.100.${email === 'first@example.test' ? 217 : 218}` },
    data: { name, email, items: [{ product_id: 1, quantity: 1 }] }
  });
  expect((await submit('First requester', 'first@example.test')).status()).toBe(200);
  expect((await submit('Second requester', 'second@example.test')).status()).toBe(200);
  const overview = await request.get('/api/admin/overview', { headers });
  const rows = (await overview.json()).requests as Array<{ id: number; email: string; reference: string }>;
  const first = rows.find(row => row.email === 'first@example.test')!;
  const second = rows.find(row => row.email === 'second@example.test')!;
  const exportOne = await request.get(`/api/admin/requests/${first.id}.csv`, { headers });
  expect(exportOne.status()).toBe(200);
  const exportText = await exportOne.text();
  expect(exportText).toContain('first@example.test');
  expect(exportText).not.toContain('second@example.test');

  await clientIp(page, 33);
  await page.goto('/owner');
  await page.locator('#owner-code').fill('e2e-owner-code-12345');
  await page.getByRole('button', { name: 'Open inbox' }).click();
  await expect(page.getByRole('link', { name: 'Export this request' }).first()).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.locator(`.delete-request[data-request="${first.id}"]`).click();
  await expect(page.locator(`.delete-request[data-request="${first.id}"]`)).toHaveCount(0);
  const after = await request.get('/api/admin/overview', { headers });
  const remaining = (await after.json()).requests as Array<{ id: number; email: string }>;
  expect(remaining.some(row => row.id === first.id || row.email === 'first@example.test')).toBe(false);
  expect(remaining.some(row => row.id === second.id && row.email === 'second@example.test')).toBe(true);
  expect((await request.get(`/api/admin/requests/${first.id}.csv`, { headers })).status()).toBe(404);
});

test('@claim:no-trackers landing and demo use only same-origin resources', async ({ page }) => {
  await clientIp(page, 14);
  const origins = new Set<string>();
  page.on('request', request => origins.add(new URL(request.url()).origin));
  await page.goto('/');
  await page.goto('/demo');
  expect([...origins]).toEqual(['http://127.0.0.1:8123']);
});

test('@claim:no-checkout sending a request never starts payment or reserves stock', async ({ page }) => {
  await clientIp(page, 15);
  const requestedUrls: string[] = [];
  page.on('request', request => requestedUrls.push(request.url()));
  await page.goto('/demo');
  await page.locator('.add').first().click();
  await page.locator('input[name="name"]').fill('No Checkout');
  await page.locator('input[name="email"]').fill('no-checkout@example.test');
  await page.getByRole('button', { name: /send request/i }).click();
  await expect(page.locator('#form-message')).toContainText('Sample request');
  expect(requestedUrls.every(url => new URL(url).origin === 'http://127.0.0.1:8123')).toBe(true);
  await page.goto('/terms');
  await expect(page.getByText('Sending a request does not create a purchase, reserve stock, or guarantee a price.')).toBeVisible();
});

test('light and dark pages have no serious accessibility violations', async ({ browser }) => {
  for (const [colorScheme, suffix] of [['light', 21], ['dark', 22]] as const) {
    const context = await browser.newContext({ colorScheme, extraHTTPHeaders: { 'x-forwarded-for': `198.51.100.${suffix}` } });
    const page = await context.newPage();
    for (const path of ['/', '/demo', '/owner', '/privacy', '/terms']) {
      await page.goto(path);
      const audit = await new AxeBuilder({ page }).analyze();
      expect(audit.violations.filter(item => ['serious', 'critical'].includes(item.impact || '')).map(item => `${path}:${item.id}`)).toEqual([]);
    }
    await context.close();
  }
});

test('keyboard navigation, route focus, and form errors are announced', async ({ page }) => {
  await clientIp(page, 23);
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  await page.getByRole('link', { name: 'Privacy' }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await page.goto('/demo');
  await page.getByRole('button', { name: /send request/i }).click();
  await expect(page.locator('#form-message')).toHaveText('Choose at least one offer before sending.');
  await expect(page.locator('#form-message')).toHaveAttribute('aria-live', 'polite');
});

test('390px layout has no overflow and interactive targets are at least 44px', async ({ page }) => {
  await clientIp(page, 24);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const undersized = await page.locator('a,button,input,textarea,select').evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    return { text: element.textContent?.trim() || element.getAttribute('name'), width: rect.width, height: rect.height };
  }).filter(item => item.width < 44 || item.height < 44));
  expect(undersized).toEqual([]);
});

test('offline submission fails softly in an isolated browser context', async ({ browser }) => {
  const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': '198.51.100.25' } });
  const page = await context.newPage();
  await page.goto('/demo');
  await page.locator('.add').first().click();
  await page.locator('input[name="name"]').fill('Offline Jordan');
  await page.locator('input[name="email"]').fill('offline@example.test');
  await context.setOffline(true);
  await page.getByRole('button', { name: /send request/i }).click();
  await expect(page.locator('#form-message')).toContainText('offline');
  await context.setOffline(false);
  await context.close();
});

test('metadata, 404 behavior, cache, security headers, and rate policy are present', async ({ page, request }) => {
  await clientIp(page, 26);
  await page.goto('/privacy');
  await expect(page).toHaveTitle('Privacy — Client Request Catalog');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://client-request-catalog.sociobot.in/privacy');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /request/);
  expect((await request.get('/robots.txt', { headers: { 'x-forwarded-for': '198.51.100.204' } })).status()).toBe(200);
  expect((await request.get('/sitemap.xml', { headers: { 'x-forwarded-for': '198.51.100.205' } })).status()).toBe(200);
  const missing = await request.get('/definitely-not-a-real-route', { headers: { 'x-forwarded-for': '198.51.100.206' } });
  expect(missing.status()).toBe(404);
  expect(await missing.text()).toContain('<title>');
  const root = await request.get('/', { headers: { 'x-forwarded-for': '198.51.100.207' } });
  expect(root.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(root.headers()['strict-transport-security']).toContain('max-age=31536000');
  expect(root.headers()['cache-control']).toBe('no-store');
  const asset = await request.get('/assets/request-desk.webp', { headers: { 'x-forwarded-for': '198.51.100.208' } });
  expect(asset.headers()['cache-control']).toContain('immutable');

  const statuses = await Promise.all(Array.from({ length: 45 }, () => request.get('/api/demo/catalog', { headers: { 'x-forwarded-for': '203.0.113.90' } })));
  const limited = statuses.find(response => response.status() === 429);
  expect(limited).toBeTruthy();
  expect(limited?.headers()['retry-after']).toBe('1');
});
