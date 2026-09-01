import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

const passphrase = 'e2e owner passphrase';
let ip = 100;
const ownerHeaders = () => ({ 'x-owner-passphrase': passphrase, 'x-forwarded-for': '198.51.100.' + ip++ });
const clientIp = (page: Page, suffix: number) => page.setExtraHTTPHeaders({ 'x-forwarded-for': '198.51.100.' + suffix });

async function ensureWorkspace(request: APIRequestContext) {
  const status = await request.get('/api/setup', { headers: { 'x-forwarded-for': '198.51.100.' + ip++ } });
  if (!(await status.json() as { claimed: boolean }).claimed) {
    expect((await request.post('/api/setup', { headers: { 'x-forwarded-for': '198.51.100.' + ip++ }, data: { business_name: 'E2E Repair Catalog', owner_passphrase: passphrase } })).status()).toBe(200);
  }
  const overview = await request.get('/api/admin/overview', { headers: ownerHeaders() });
  const products = (await overview.json()).products as unknown[];
  for (let index = products.length; index < 3; index += 1) {
    expect((await request.post('/api/admin/products', { headers: ownerHeaders(), data: { name: ['Quarterly maintenance visit', 'Replacement fitting set', 'Repeat consumables pack'][index], description: 'Test offer ' + (index + 1), price_cents: index === 1 ? '' : '4200' } })).status()).toBe(200);
  }
}

test('@claim:owner-onboarding first-run setup brands a real catalog', async ({ page, request }) => {
  expect((await (await request.get('/api/setup', { headers: { 'x-forwarded-for': '198.51.100.1' } })).json()).claimed).toBe(false);
  await page.goto('/demo');
  await expect(page.getByRole('link', { name: 'Start for real' })).toHaveAttribute('href', '/owner');
  await page.getByRole('link', { name: 'Start for real' }).click();
  await expect(page.getByRole('heading', { name: 'Create your private owner workspace' })).toBeVisible();
  await expect(page.locator('input[name="offer_ids"]')).toHaveCount(0);
  await page.locator('input[name="business_name"]').fill('Cedar Repair Co.');
  await page.locator('input[name="owner_passphrase"]').fill(passphrase);
  await page.locator('input[name="confirm_passphrase"]').fill(passphrase);
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
