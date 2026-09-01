import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

const authToken = 'e2e-test-entra-token';
let ip = 100;
const ownerHeaders = () => ({ authorization: `Bearer ${authToken}`, 'x-forwarded-for': '198.51.100.' + ip++ });
const clientIp = (page: Page, suffix: number) => page.setExtraHTTPHeaders({ 'x-forwarded-for': '198.51.100.' + suffix });
const authenticateOwnerPage = (page: Page) => page.addInitScript(token => sessionStorage.setItem('crc-test-auth-token', token), authToken);

async function ensureWorkspace(request: APIRequestContext) {
  const status = await request.get('/api/setup', { headers: ownerHeaders() });
  if (!(await status.json() as { claimed: boolean }).claimed) {
    expect((await request.post('/api/setup', { headers: ownerHeaders(), data: { business_name: 'E2E Repair Catalog' } })).status()).toBe(200);
  }
  const overview = await request.get('/api/admin/overview', { headers: ownerHeaders() });
  const products = (await overview.json()).products as unknown[];
  for (let index = products.length; index < 3; index += 1) {
    expect((await request.post('/api/admin/products', { headers: ownerHeaders(), data: { name: ['Quarterly maintenance visit', 'Replacement fitting set', 'Repeat consumables pack'][index], description: 'Test offer ' + (index + 1), price_cents: index === 1 ? '' : '4200' } })).status()).toBe(200);
  }
}

test('@claim:owner-onboarding first-run setup brands a real catalog', async ({ page, request }) => {
  expect((await request.get('/api/setup', { headers: { 'x-forwarded-for': '198.51.100.1' } })).status()).toBe(401);
  expect((await (await request.get('/api/setup', { headers: ownerHeaders() })).json()).claimed).toBe(false);
  await authenticateOwnerPage(page);
  await page.goto('/demo');
  await expect(page.getByRole('link', { name: 'Start for real' })).toHaveAttribute('href', '/owner');
  await page.getByRole('link', { name: 'Start for real' }).click();
  await expect(page.getByRole('heading', { name: 'Create your private owner workspace' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with Microsoft' })).toHaveCount(0);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.locator('input[name="offer_ids"]')).toHaveCount(0);
  await page.locator('input[name="business_name"]').fill('Cedar Repair Co.');
  await page.getByRole('button', { name: 'Create owner workspace' }).click();
  await page.locator('#product-form input[name="name"]').fill('Quarterly maintenance visit');
  await page.locator('#product-form textarea[name="description"]').fill('A careful service visit.');
  await page.getByRole('button', { name: 'Add offer' }).click();
  await expect(page.getByText('Quarterly maintenance visit').last()).toBeVisible();
  await page.locator('#client-form input[name="name"]').fill('June at Acorn House');
  await page.locator('#client-form input[name="offer_ids"]').check();
  await page.locator('#client-form').getByRole('button', { name: 'Create private link' }).click();
  const overview = await request.get('/api/admin/overview', { headers: ownerHeaders() });
  const created = ((await overview.json()).clients as Array<{ name: string; token: string }>).find(client => client.name === 'June at Acorn House')!;
  await page.locator('#business-form input[name="business_name"]').fill('Cedar Home Repair');
  await page.getByRole('button', { name: 'Save business name' }).click();
  await expect.poll(async () => (await (await request.get('/api/catalog/' + created.token, { headers: { 'x-forwarded-for': '198.51.100.2' } })).json()).business_name).toBe('Cedar Home Repair');
});

test('@claim:demo-isolated sample requests never enter the real inbox', async ({ page, request }) => {
  await ensureWorkspace(request);
  const before = (await (await request.get('/api/admin/overview', { headers: ownerHeaders() })).json()).requests.length;
  const paths: string[] = [];
  page.on('request', item => paths.push(new URL(item.url()).pathname));
  await clientIp(page, 11);
  await page.goto('/demo');
  await page.locator('.add').first().click();
  await page.locator('input[name="name"]').fill('Jordan Example');
  await page.locator('input[name="email"]').fill('jordan@example.test');
  await page.getByRole('button', { name: /send request/i }).click();
  await expect(page.locator('#form-message')).toContainText('Nothing was saved');
  expect(paths).toContain('/api/demo/requests');
  expect(paths.some(value => value.startsWith('/api/catalog/'))).toBe(false);
  expect((await (await request.get('/api/admin/overview', { headers: ownerHeaders() })).json()).requests.length).toBe(before);
});

test('@claim:private-prices opaque links hide and revoke prices', async ({ page, request }) => {
  await ensureWorkspace(request);
  await page.goto('/');
  await expect(page.locator('.offer')).toHaveCount(0);
  const made = await request.post('/api/admin/clients', { headers: ownerHeaders(), data: { name: 'Regression Client', expires_in_days: 30, offer_ids: [1] } });
  const link = await made.json() as { id: number; token: string };
  expect(link.token).toMatch(/^[A-Za-z0-9]{40}$/);
  expect((await (await request.get('/api/catalog/' + link.token, { headers: { 'x-forwarded-for': '198.51.100.12' } })).json()).products).toHaveLength(1);
  expect((await request.delete('/api/admin/clients/' + link.id, { headers: ownerHeaders() })).status()).toBe(200);
  expect((await request.get('/api/catalog/' + link.token, { headers: { 'x-forwarded-for': '198.51.100.13' } })).status()).toBe(410);
});

test('@claim:request-inbox valid browser requests reach the owner inbox', async ({ page, request }) => {
  await ensureWorkspace(request);
  const made = await request.post('/api/admin/clients', { headers: ownerHeaders(), data: { name: 'North Street', expires_in_days: 30, offer_ids: [1] } });
  const token = (await made.json() as { token: string }).token;
  await clientIp(page, 14);
  await page.goto('/?client=' + token);
  await page.locator('.add').first().click();
  await page.locator('input[name="name"]').fill('Taylor Requester');
  await page.locator('input[name="email"]').fill('taylor@example.test');
  await page.getByRole('button', { name: /send request/i }).click();
  await expect(page.locator('#form-message')).toContainText(/Request CRC-\d{6} is in the inbox/);
});

test('@claim:owner-exports owner exports CSV and PDF', async ({ request }) => {
  await ensureWorkspace(request);
  const csv = await request.get('/api/admin/requests.csv', { headers: ownerHeaders() });
  expect(await csv.text()).toContain('reference,name,email,status,created_at,items,note');
  const pdf = await request.get('/api/admin/requests.pdf', { headers: ownerHeaders() });
  expect(new TextDecoder().decode((await pdf.body()).subarray(0, 8))).toBe('%PDF-1.4');
});

test('@claim:client-offer-visibility each client link has its assigned offers', async ({ request }) => {
  await ensureWorkspace(request);
  const alpha = await request.post('/api/admin/clients', { headers: ownerHeaders(), data: { name: 'Alpha', expires_in_days: 30, offer_ids: [1] } });
  const beta = await request.post('/api/admin/clients', { headers: ownerHeaders(), data: { name: 'Beta', expires_in_days: 30, offer_ids: [2] } });
  const alphaToken = (await alpha.json() as { token: string }).token;
  const betaToken = (await beta.json() as { token: string }).token;
  expect((await (await request.get('/api/catalog/' + alphaToken, { headers: { 'x-forwarded-for': '198.51.100.15' } })).json()).products.map((product: { id: number }) => product.id)).toEqual([1]);
  expect((await (await request.get('/api/catalog/' + betaToken, { headers: { 'x-forwarded-for': '198.51.100.16' } })).json()).products.map((product: { id: number }) => product.id)).toEqual([2]);
});

test('@claim:individual-request-privacy @claim:deletion-audit-minimal one-request export and deletion retain only audit fields', async ({ request }) => {
  await ensureWorkspace(request);
  const headers = ownerHeaders();
  const client = await request.post('/api/admin/clients', { headers, data: { name: 'Privacy', expires_in_days: 30, offer_ids: [1] } });
  const token = (await client.json() as { token: string }).token;
  for (const [email, suffix] of [['first@example.test', '17'], ['second@example.test', '18']] as const) {
    expect((await request.post('/api/catalog/' + token + '/requests', { headers: { 'x-forwarded-for': '198.51.100.' + suffix }, data: { name: 'Requester', email, items: [{ product_id: 1, quantity: 1 }] } })).status()).toBe(200);
  }
  const rows = (await (await request.get('/api/admin/overview', { headers })).json()).requests as Array<{ id: number; email: string }>;
  const first = rows.find(row => row.email === 'first@example.test')!;
  const second = rows.find(row => row.email === 'second@example.test')!;
  expect(await (await request.get('/api/admin/requests/' + first.id + '.csv', { headers })).text()).toContain('first@example.test');
  expect((await request.delete('/api/admin/requests/' + first.id, { headers })).status()).toBe(200);
  expect((await request.get('/api/admin/requests/' + first.id + '.csv', { headers })).status()).toBe(404);
  expect((await (await request.get('/api/admin/overview', { headers })).json()).requests.some((row: { id: number }) => row.id === second.id)).toBe(true);
  const audit = (await (await request.get('/api/admin/deletion-audit', { headers })).json() as Array<Record<string, unknown>>).find(row => row.request_id === first.id)!;
  expect(Object.keys(audit).sort()).toEqual(['action', 'deleted_at', 'request_id']);
  expect(JSON.stringify(audit)).not.toContain('first@example.test');
});

test('@claim:hosted-subscription monthly plan hands off to Sociobot checkout', async ({ page }) => {
  await page.goto('/');
  const checkout = page.locator('[data-subscription-checkout]').first();
  await expect(checkout).toHaveText(/Start monthly plan/);
  await expect(checkout).toHaveAttribute('href', 'https://api.sociobot.in/api/v1/products/client-request-catalog/checkout?plan=monthly');
});

test('@claim:no-trackers and @claim:no-checkout use no third-party request', async ({ page }) => {
  const origins = new Set<string>();
  page.on('request', request => origins.add(new URL(request.url()).origin));
  await page.goto('/');
  await page.goto('/demo');
  await page.locator('.add').first().click();
  await page.locator('input[name="name"]').fill('No Checkout');
  await page.locator('input[name="email"]').fill('no-checkout@example.test');
  await page.getByRole('button', { name: /send request/i }).click();
  await expect(page.locator('#form-message')).toContainText('Sample request');
  expect([...origins]).toEqual(['http://127.0.0.1:8123']);
});

test('@claim:entra-owner-auth owner identity uses Sociobot Entra and mobile billing target is at least 44px', async ({ page, request }) => {
  const configResponse = await request.get('/api/auth/config', { headers: { 'x-forwarded-for': '198.51.100.81' } });
  expect(configResponse.status()).toBe(200);
  const config = await configResponse.json() as { authority: string; client_id: string; redirect_uri: string };
  expect(config).toMatchObject({
    authority: 'https://sociobotcustomers.ciamlogin.com/35c6fe40-0ec0-46b6-98c6-213ad4de6650/',
    client_id: '25c704f4-465a-47af-80ab-2c489466b697',
    redirect_uri: '/auth/callback'
  });
  const unauthorized = await request.get('/api/admin/overview', {
    headers: { 'x-owner-passphrase': 'legacy local password', 'x-forwarded-for': '198.51.100.82' }
  });
  expect(unauthorized.status()).toBe(401);
  expect(unauthorized.headers()['www-authenticate']).toBe('Bearer');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/owner');
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign in with Microsoft' })).toBeVisible();
  const termsBox = await page.getByRole('link', { name: 'Read plan and billing terms' }).boundingBox();
  expect(termsBox).not.toBeNull();
  expect(termsBox!.width).toBeGreaterThanOrEqual(44);
  expect(termsBox!.height).toBeGreaterThanOrEqual(44);

  const outbound = page.waitForRequest(item => new URL(item.url()).hostname === 'sociobotcustomers.ciamlogin.com');
  await page.getByRole('button', { name: 'Sign in with Microsoft' }).click();
  const requestToEntra = await outbound;
  expect(requestToEntra.url()).toContain('/35c6fe40-0ec0-46b6-98c6-213ad4de6650/');
});

test('mobile landing uses the small hero and keeps auth work off the main route', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => {
    (window as typeof window & { __crcLongTasks: number }).__crcLongTasks = 0;
    new PerformanceObserver(list => {
      const measured = list.getEntries().reduce((total, entry) => total + Math.max(0, entry.duration - 50), 0);
      (window as typeof window & { __crcLongTasks: number }).__crcLongTasks += measured;
    }).observe({ type: 'longtask', buffered: true });
  });
  await page.goto('/');
  await page.waitForTimeout(250);
  const hero = page.locator('.landing-hero img');
  await expect(hero).toBeVisible();
  expect(await hero.evaluate((image: HTMLImageElement) => new URL(image.currentSrc).pathname)).toBe('/assets/request-desk-480.avif');
  const metrics = await page.evaluate(() => ({
    longTaskBlockingMs: (window as typeof window & { __crcLongTasks: number }).__crcLongTasks,
    heroBytes: performance.getEntriesByType('resource')
      .filter(entry => entry.name.endsWith('/assets/request-desk-480.avif'))
      .reduce((total, entry) => total + (entry as PerformanceResourceTiming).encodedBodySize, 0),
    loadedAuthChunk: performance.getEntriesByType('resource').some(entry => /\/auth-[^/]+\.js$/.test(new URL(entry.name).pathname))
  }));
  expect(metrics.heroBytes).toBeGreaterThan(0);
  expect(metrics.heroBytes).toBeLessThan(15_000);
  expect(metrics.longTaskBlockingMs).toBeLessThan(100);
  expect(metrics.loadedAuthChunk).toBe(false);
});

test('desktop/mobile keyboard, accessibility, offline, metadata and limits pass', async ({ page, request, browser }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  expect(await page.locator('.plain-facts li').evaluateAll(items => items.every(item => item.getBoundingClientRect().bottom <= window.innerHeight))).toBe(true);
  await page.getByRole('link', { name: 'Privacy' }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  for (const route of ['/demo', '/owner', '/privacy', '/terms']) {
    await page.goto(route);
    const audit = await new AxeBuilder({ page }).analyze();
    expect(audit.violations.filter(item => ['serious', 'critical'].includes(item.impact || '')).length).toBe(0);
  }
  expect((await request.get('/definitely-not-a-real-route', { headers: { 'x-forwarded-for': '198.51.100.19' } })).status()).toBe(404);
  const publicResponses = await Promise.all(Array.from({ length: 45 }, () => request.get('/api/demo/catalog', { headers: { 'x-forwarded-for': '203.0.113.90' } })));
  expect(publicResponses.some(response => response.status() === 429 && response.headers()['retry-after'] === '1')).toBe(true);
  const ownerResponses = await Promise.all(Array.from({ length: 9 }, () => request.get('/api/admin/not-a-route', { headers: { 'x-forwarded-for': '203.0.113.91' } })));
  expect(ownerResponses.some(response => response.status() === 429 && response.headers()['retry-after'] === '1')).toBe(true);
  const context = await browser.newContext();
  const offline = await context.newPage();
  await offline.goto('/demo');
  await offline.locator('.add').first().click();
  await offline.locator('input[name="name"]').fill('Offline');
  await offline.locator('input[name="email"]').fill('offline@example.test');
  await context.setOffline(true);
  await offline.getByRole('button', { name: /send request/i }).click();
  await expect(offline.locator('#form-message')).toContainText('offline');
  await context.close();
});
