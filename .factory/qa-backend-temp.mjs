import fs from 'node:fs';

const base = 'http://127.0.0.1:18123';
const ownerCode = fs.readFileSync('/tmp/crc-backend-qa-9baa/owner-code.txt', 'utf8').trim();
let ip = 10;
const call = async (path, init = {}) => {
  const headers = {
    'content-type': 'application/json',
    'x-forwarded-for': `198.51.100.${ip++}`,
    ...(init.owner ? { 'x-owner-code': ownerCode } : {}),
    ...(init.headers || {}),
  };
  const response = await fetch(base + path, { ...init, headers });
  const type = response.headers.get('content-type') || '';
  const body = type.includes('json') ? await response.json() : await response.arrayBuffer();
  return { status: response.status, type, body, headers: Object.fromEntries(response.headers) };
};
const postRequest = (body, key) => call('/api/catalog/demo-client/requests', {
  method: 'POST',
  body: JSON.stringify(body),
  headers: key ? { 'x-forwarded-for': key } : undefined,
});
const baseRequest = {
  name: 'Jordan Example',
  email: 'jordan@example.test',
  phone: '+1 555 0100',
  reference: 'PO-1842',
  note: 'Please quote delivery for next Tuesday.',
  items: [{ product_id: 1, quantity: 1 }, { product_id: 2, quantity: 2 }],
};
const results = {};
results.health = await call('/health');
results.catalog = await call('/api/catalog/demo-client');
results.unknownClient = await call('/api/catalog/not-a-client');
results.emptyName = await postRequest({ ...baseRequest, name: '' });
results.invalidEmail = await postRequest({ ...baseRequest, email: 'not-email' });
results.noItems = await postRequest({ ...baseRequest, items: [] });
results.quantityZero = await postRequest({ ...baseRequest, items: [{ product_id: 1, quantity: 0 }] });
results.quantity101 = await postRequest({ ...baseRequest, items: [{ product_id: 1, quantity: 101 }] });
results.unknownProduct = await postRequest({ ...baseRequest, items: [{ product_id: 999999, quantity: 1 }] });
results.normal = await postRequest(baseRequest);
results.boundaryAccepted = await postRequest({
  ...baseRequest,
  name: 'N'.repeat(120),
  note: 'x'.repeat(2000),
  items: Array.from({ length: 30 }, () => ({ product_id: 1, quantity: 100 })),
});
results.nameTooLong = await postRequest({ ...baseRequest, name: 'N'.repeat(121) });
results.noteTooLong = await postRequest({ ...baseRequest, note: 'x'.repeat(2001) });
results.tooManyItems = await postRequest({ ...baseRequest, items: Array.from({ length: 31 }, () => ({ product_id: 1, quantity: 1 })) });
results.recovery = await postRequest({ ...baseRequest, name: 'Recovery Works' });
results.ownerWrong = await call('/api/admin/overview', { headers: { 'x-owner-code': 'wrong-code-value' } });
results.ownerOverview = await call('/api/admin/overview', { owner: true });
const firstId = results.ownerOverview.body.requests[0]?.id;
results.invalidStatus = await call(`/api/admin/requests/${firstId}`, { owner: true, method: 'PATCH', body: JSON.stringify({ status: 'paid' }) });
results.validStatus = await call(`/api/admin/requests/${firstId}`, { owner: true, method: 'PATCH', body: JSON.stringify({ status: 'quoted' }) });
results.invalidOffer = await call('/api/admin/products', { owner: true, method: 'POST', body: JSON.stringify({ name: '', description: 'x', price_cents: '-1' }) });
results.validPoaOffer = await call('/api/admin/products', { owner: true, method: 'POST', body: JSON.stringify({ name: 'Made-to-measure panel', description: 'Measured and quoted for the existing frame.', price_cents: '', stock_note: 'Measured before quoting.' }) });
results.csv = await call('/api/admin/requests.csv', { owner: true });
results.pdf = await call('/api/admin/requests.pdf', { owner: true });
results.delete = await call('/api/admin/requests', { owner: true, method: 'DELETE' });
results.afterDelete = await call('/api/admin/overview', { owner: true });

const concurrent = await Promise.all(Array.from({ length: 20 }, (_, i) => postRequest({
  ...baseRequest,
  name: `Concurrent ${i}`,
  email: `concurrent${i}@example.test`,
  reference: `LOAD-${i}`,
}, `203.0.113.${i + 1}`)));
results.concurrent = {
  statuses: concurrent.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] || 0) + 1 }), {}),
  errors: concurrent.filter(item => item.status !== 200).map(item => item.body),
};
results.afterConcurrency = await call('/api/admin/overview', { owner: true });

const summary = {};
for (const [key, value] of Object.entries(results)) {
  if (key === 'concurrent') summary[key] = value;
  else if (key === 'catalog') summary[key] = { status: value.status, products: value.body.products?.length };
  else if (key === 'ownerOverview' || key === 'afterDelete' || key === 'afterConcurrency') summary[key] = { status: value.status, requests: value.body.requests?.length, products: value.body.products?.length };
  else if (key === 'csv') summary[key] = { status: value.status, type: value.type, bytes: value.body.byteLength };
  else if (key === 'pdf') summary[key] = { status: value.status, type: value.type, bytes: value.body.byteLength, pdfHeader: Buffer.from(value.body).subarray(0, 8).toString() };
  else summary[key] = { status: value.status, body: value.body };
}
console.log(JSON.stringify(summary, null, 2));
