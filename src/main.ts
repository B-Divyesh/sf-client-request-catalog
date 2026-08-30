import './style.css';

type Product = { id: number; name: string; description: string; price_cents: number | null; currency: string; stock_note: string; visible: boolean };
type Catalog = { business_name: string; client_name: string; expires_at: string; products: Product[] };
type Item = { product_id: number; quantity: number };
type ClientLink = { id: number; name: string; token: string; expires_at: string };
type InboxRow = { id: number; reference: string; name: string; email: string; note?: string; status: string; created_at: string; items: string };
type OwnerData = { business_name: string; clients: ClientLink[]; products: Product[]; requests: InboxRow[] };

const $ = <T extends Element>(selector: string) => document.querySelector(selector) as T;
const app = $('#app');
const path = location.pathname;
const clientToken = new URLSearchParams(location.search).get('client') || '';
const demoMode = path === '/demo';
let basket: Item[] = [];
let catalog: Catalog | null = null;
let ownerCode = sessionStorage.getItem('crc-owner-code') || '';

function esc(value: unknown) { const node = document.createElement('div'); node.textContent = String(value ?? ''); return node.innerHTML; }
function money(cents: number | null, currency = 'USD') { return cents === null ? 'Price on application' : new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100); }
function api(url: string, init?: RequestInit) { return fetch(url, { ...init, headers: { 'content-type': 'application/json', ...(ownerCode ? { 'x-owner-code': ownerCode } : {}), ...(init?.headers || {}) } }); }

function setMeta(title: string, description: string, canonicalPath: string) {
  document.title = title;
  const values: Array<[string, string, string]> = [
    ['name', 'description', description], ['property', 'og:title', title], ['property', 'og:description', description],
    ['property', 'og:image', 'https://client-request-catalog.sociobot.in/assets/og-request-desk.webp'], ['property', 'og:type', 'website'],
    ['name', 'twitter:card', 'summary_large_image'], ['name', 'twitter:title', title], ['name', 'twitter:description', description]
  ];
  for (const [attribute, key, content] of values) {
    let meta = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute(attribute, key); document.head.append(meta); }
    meta.content = content;
  }
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); }
  canonical.href = `https://client-request-catalog.sociobot.in${canonicalPath}`;
}

function focusRouteHeading() {
  if (sessionStorage.getItem('crc-focus-heading') !== '1') return;
  sessionStorage.removeItem('crc-focus-heading');
  requestAnimationFrame(() => { const heading = document.querySelector<HTMLHeadingElement>('main h1'); if (heading) { heading.tabIndex = -1; heading.focus(); } });
}
document.addEventListener('click', event => {
  const link = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
  if (link && link.origin === location.origin && link.pathname !== location.pathname) sessionStorage.setItem('crc-focus-heading', '1');
});

function shell(content: string, options: { title: string; description: string; canonical: string; demo?: boolean }) {
  setMeta(options.title, options.description, options.canonical);
  const banner = options.demo ? '<aside class="demo-banner" aria-label="Demo status"><strong>Demo — sample data, nothing is saved</strong><span><button id="reset-demo" type="button">Reset demo</button><a href="/">Start for real</a></span></aside>' : '';
  app.innerHTML = `<header class="site-head"><a class="wordmark" href="/" aria-label="Request Slip home">REQUEST<br><i>SLIP</i></a><nav aria-label="Primary"><a href="/demo">Demo</a><a href="/owner">Owner workspace</a><a href="/privacy">Privacy</a></nav></header>${banner}<main id="main" tabindex="-1">${content}</main><footer><span>Private request catalogs for small businesses · Version 1.1</span><span><a href="/privacy">Privacy</a><a href="/terms">Terms</a><span>Built by Param Factory</span></span></footer><div class="route-announcer" aria-live="polite">${esc(options.title)}</div>`;
  focusRouteHeading();
}

function renderLanding() {
  shell(`<section class="landing-hero"><div><p class="eyebrow">Client Request Catalog</p><h1>Create private catalogs for repeat clients</h1><p class="lede">Small businesses can share prices, collect clear requests, and keep checkout out of the conversation.</p><div class="hero-action"><a class="stamp" href="/demo">Try it with sample data</a><span>See a filled catalog in one click.</span></div><ul class="plain-facts"><li>Prices require a private link.</li><li>Requests arrive in one owner inbox.</li><li>No analytics or tracking scripts.</li></ul></div><img src="/assets/request-desk.webp" width="960" height="640" fetchpriority="high" decoding="async" alt="A blank request slip beside a ruler and spool in two-colour print." /></section><section class="preview" aria-labelledby="preview-title"><div class="section-title"><div><p class="eyebrow">Client view</p><h2 id="preview-title">Show only the offers a client needs</h2></div><p>Fixed-price and quote-first offers can sit together.</p></div><div class="preview-lines" aria-label="Sample offer types"><p><strong>Maintenance visit</strong><span>Fixed price</span></p><p><strong>Replacement fitting set</strong><span>Price on application</span></p><p><strong>Repeat supplies</strong><span>Previous order</span></p></div></section><section class="how"><p class="eyebrow">How it works</p><h2>From private link to clear request</h2><ol><li><strong>Create a client link.</strong><span>Name the client and choose when access ends.</span></li><li><strong>Share the catalog.</strong><span>Only someone with that opaque link can view its prices.</span></li><li><strong>Reply from the inbox.</strong><span>Review selected offers, contact details, and notes together.</span></li></ol></section><section class="limits"><div><p class="eyebrow">Clear boundaries</p><h2>This is not a checkout</h2></div><p>It does not charge clients, reserve stock, or promise availability. The business confirms every request directly.</p></section>`, {
    title: 'Client Request Catalog — share private prices', description: 'Create private client catalogs, collect clear quote requests, and manage them in one owner inbox.', canonical: '/'
  });
}

function itemCount() { return basket.reduce((count, item) => count + item.quantity, 0); }
function renderCatalog() {
  if (!catalog) return;
  const offers = catalog.products.length ? catalog.products.map(product => `<article class="offer" data-id="${product.id}"><div><p class="eyebrow">${product.price_cents === null ? 'Made to quote' : 'Fixed price'}</p><h2>${esc(product.name)}</h2><p>${esc(product.description)}</p><small>${esc(product.stock_note || 'Availability is confirmed with the quote.')}</small></div><div class="offer-action"><strong>${money(product.price_cents, product.currency)}</strong><button class="add" data-id="${product.id}" type="button">${product.price_cents === null ? 'Request a quote' : 'Add to request'}</button></div></article>`).join('') : '<section class="empty"><h2>No offers are visible yet</h2><p>Ask the business when its next request window opens.</p></section>';
  const title = demoMode ? 'Demo — Client Request Catalog' : `${catalog.business_name} — private request catalog`;
  shell(`<section class="mast"><div><p class="eyebrow">${demoMode ? 'Sample private catalog' : `Private client catalog · expires ${new Date(catalog.expires_at).toLocaleDateString()}`}</p><h1>${esc(catalog.business_name)}<br><em>for ${esc(catalog.client_name)}</em></h1><p class="lede">Select what you need. Fixed prices are marked. Other offers become a quote request. Nothing is charged here.</p><a class="stamp" href="#request">Start a request <span aria-hidden="true">↓</span></a></div><img src="/assets/request-desk.webp" width="960" height="640" fetchpriority="high" decoding="async" alt="A blank request slip beside a ruler and spool in two-colour print." /></section><section class="catalog-head"><div><p class="eyebrow">Available to you</p><h2>Choose what you need</h2></div><p>${demoMode ? 'These prices and offers are fictional sample data.' : 'Prices and availability are private to this link.'}</p></section><section class="offers" aria-label="Available offers">${offers}</section><section id="request" class="request-slip" aria-labelledby="request-title"><div class="slip-heading"><p class="eyebrow">Your request · <span id="count">${itemCount()}</span> item${itemCount() === 1 ? '' : 's'}</p><h2 id="request-title">Prepare your request</h2><p id="basket-copy">${basket.length ? 'Your selected offers appear in this request.' : 'Choose an offer above, then add your contact details.'}</p></div><form id="request-form" novalidate><div class="form-grid"><label>Your name<input name="name" autocomplete="name" required aria-describedby="form-message" /></label><label>Email for the quote<input name="email" type="email" autocomplete="email" required aria-describedby="form-message" /></label><label>Phone <span>(optional)</span><input name="phone" type="tel" autocomplete="tel" /></label><label>Reference or PO number <span>(optional)</span><input name="reference" /></label></div><label>Request notes <span>(optional)</span><textarea name="note" rows="3" placeholder="Timing, size, colour, or delivery details"></textarea></label><p id="form-message" class="form-message" role="status" aria-live="polite"></p><button class="submit" type="submit">Send request <span aria-hidden="true">→</span></button></form></section>`, {
    title, description: demoMode ? 'Try a complete private request catalog with fictional sample data. Nothing is saved.' : 'Review private prices and send a clear request to the business.', canonical: demoMode ? '/demo' : '/', demo: demoMode
  });
  document.querySelectorAll<HTMLButtonElement>('.add').forEach(button => button.addEventListener('click', () => addItem(Number(button.dataset.id))));
  $<HTMLFormElement>('#request-form').addEventListener('submit', submitRequest);
  $('#reset-demo')?.addEventListener('click', () => { basket = []; catalog = null; void loadCatalog(); });
}

function addItem(id: number) {
  const found = basket.find(item => item.product_id === id);
  if (found) found.quantity += 1; else basket.push({ product_id: id, quantity: 1 });
  $('#count').textContent = String(itemCount());
  $('#basket-copy').textContent = `${itemCount()} item${itemCount() === 1 ? '' : 's'} selected. Add more, or send when ready.`;
  const button = document.querySelector<HTMLButtonElement>(`.add[data-id="${id}"]`);
  if (button) { button.textContent = 'Added ✓'; window.setTimeout(() => { button.textContent = catalog?.products.find(product => product.id === id)?.price_cents === null ? 'Request a quote' : 'Add to request'; }, 900); }
}

async function submitRequest(event: SubmitEvent) {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const message = $('#form-message');
  const body = Object.fromEntries(new FormData(form));
  if (!String(body.name).trim() || !String(body.email).includes('@') || !basket.length) { message.textContent = !basket.length ? 'Choose at least one offer before sending.' : 'Enter your name and a valid email address.'; return; }
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  button.disabled = true; button.textContent = 'Sending…';
  try {
    const endpoint = demoMode ? '/api/demo/requests' : `/api/catalog/${encodeURIComponent(clientToken)}/requests`;
    const response = await api(endpoint, { method: 'POST', body: JSON.stringify({ ...body, items: basket }) });
    const data = await response.json() as { reference?: string; error?: string };
    if (!response.ok) throw new Error(data.error || 'The request could not be sent. Try again.');
    basket = []; form.reset();
    message.textContent = demoMode ? `Sample request ${data.reference} complete. Nothing was saved.` : `Request ${data.reference} is in the inbox. The business will reply to ${body.email}.`;
  } catch (error) { message.textContent = navigator.onLine ? (error as Error).message : 'You are offline. Reconnect, then send your request.'; }
  finally { button.disabled = false; button.innerHTML = 'Send request <span aria-hidden="true">→</span>'; $('#count').textContent = '0'; }
}

async function loadCatalog() {
  const endpoint = demoMode ? '/api/demo/catalog' : `/api/catalog/${encodeURIComponent(clientToken)}`;
  shell(`<section class="loading"><p class="eyebrow">${demoMode ? 'Loading sample data' : 'Checking private link'}</p><h1>${demoMode ? 'Opening the sample catalog…' : 'Opening your private catalog…'}</h1></section>`, {
    title: demoMode ? 'Demo — Client Request Catalog' : 'Private catalog — Client Request Catalog', description: 'Open a private request catalog.', canonical: demoMode ? '/demo' : '/', demo: demoMode
  });
  try {
    const response = await api(endpoint);
    if (!response.ok) throw new Error(response.status === 410 ? 'This client link has expired or was revoked.' : 'This catalog could not be opened.');
    catalog = await response.json() as Catalog; renderCatalog();
  } catch (error) {
    shell(`<section class="empty"><p class="eyebrow">Private link unavailable</p><h1>${esc((error as Error).message)}</h1><p>Check the complete link, or ask the business to create a new one.</p><button id="retry-catalog" type="button">Try again</button></section>`, {
      title: 'Private link unavailable — Client Request Catalog', description: 'This private client catalog link is unavailable.', canonical: '/'
    });
    $('#retry-catalog').addEventListener('click', () => void loadCatalog());
  }
}

function loginScreen(message = '') {
  shell(`<section class="owner-login"><p class="eyebrow">Owner workspace</p><h1>Open your private request inbox</h1><p>Enter the owner code stored in <code>/data/owner-code.txt</code> for this service.</p><label>Owner code<input id="owner-code" type="password" autocomplete="current-password" aria-describedby="owner-message" /></label><p id="owner-message" class="form-message" role="status" aria-live="polite">${esc(message)}</p><button id="owner-login" type="button">Open inbox</button></section>`, {
    title: 'Owner workspace — Client Request Catalog', description: 'Manage private client links, offers, and incoming requests.', canonical: '/owner'
  });
  $('#owner-login').addEventListener('click', async () => { ownerCode = ($('#owner-code') as HTMLInputElement).value; sessionStorage.setItem('crc-owner-code', ownerCode); await loadOwner(); });
}

async function loadOwner() {
  if (!ownerCode) return loginScreen();
  shell('<section class="loading"><h1>Opening your request inbox…</h1></section>', { title: 'Owner workspace — Client Request Catalog', description: 'Manage private client links, offers, and incoming requests.', canonical: '/owner' });
  try {
    const response = await api('/api/admin/overview');
    if (response.status === 401) { ownerCode = ''; sessionStorage.removeItem('crc-owner-code'); return loginScreen('That code did not match. Read the code from /data/owner-code.txt.'); }
    const data = await response.json() as OwnerData & { error?: string };
    if (!response.ok) throw new Error(data.error || 'The inbox could not be opened.');
    renderOwner(data);
  } catch (error) { loginScreen((error as Error).message); }
}

function renderOwner(data: OwnerData) {
  const requests = data.requests.length ? data.requests.map(request => `<li class="inbox-row"><div><strong>${esc(request.reference)}</strong><span class="status ${esc(request.status)}">${esc(request.status)}</span><p>${esc(request.name)} · ${esc(request.email)}${request.note ? `<br>${esc(request.note)}` : ''}</p><small>${esc(request.items)}</small></div><div><time datetime="${esc(request.created_at)}">${new Date(request.created_at).toLocaleDateString()}</time><label class="visually-hidden" for="status-${request.id}">Status for ${esc(request.reference)}</label><select id="status-${request.id}" data-status="${request.id}"><option ${request.status === 'new' ? 'selected' : ''}>new</option><option ${request.status === 'quoted' ? 'selected' : ''}>quoted</option><option ${request.status === 'closed' ? 'selected' : ''}>closed</option></select></div></li>`).join('') : '<li class="empty"><h3>Your inbox is clear</h3><p>Create and share a private client link to receive requests.</p></li>';
  const clients = data.clients.length ? data.clients.map(client => {
    const active = new Date(client.expires_at).getTime() > Date.now(); const url = `${location.origin}/?client=${encodeURIComponent(client.token)}`;
    return `<li class="client-row"><div><strong>${esc(client.name)}</strong><span>${active ? `Expires ${new Date(client.expires_at).toLocaleDateString()}` : 'Revoked or expired'}</span><code>${esc(url)}</code></div><div>${active ? `<button class="copy-client" data-url="${esc(url)}" type="button">Copy link</button><button class="revoke-client danger" data-client="${client.id}" data-name="${esc(client.name)}" type="button">Revoke</button>` : ''}</div></li>`;
  }).join('') : '<li class="empty"><h3>No client links yet</h3><p>Create a link before sharing any prices.</p></li>';
  shell(`<section class="owner-head"><div><p class="eyebrow">Owner workspace</p><h1>${esc(data.business_name)}<br><em>request desk</em></h1></div><div class="owner-actions"><a class="button-outline" href="/api/admin/requests.csv" id="csv">Export CSV</a><a class="button-outline" href="/api/admin/requests.pdf" id="pdf">Export PDF</a><button id="logout" type="button">Lock workspace</button></div></section><section class="metrics"><div><strong>${data.requests.filter(request => request.status === 'new').length}</strong><span>New requests</span></div><div><strong>${data.products.filter(product => product.visible).length}</strong><span>Visible offers</span></div><div><strong>${data.clients.filter(client => new Date(client.expires_at).getTime() > Date.now()).length}</strong><span>Active client links</span></div></section><section class="client-manager" aria-labelledby="client-links-title"><div class="section-title"><div><p class="eyebrow">Private access</p><h2 id="client-links-title">Client links</h2></div><p>Each link uses an opaque 40-character token.</p></div><form id="client-form"><div class="form-grid"><label>Client name<input name="name" required maxlength="120" /></label><label>Expires after<input name="expires_in_days" type="number" min="1" max="365" value="90" required /></label></div><p class="form-message" id="client-message" role="status" aria-live="polite"></p><button type="submit">Create private link</button></form><ul class="client-list">${clients}</ul></section><section class="owner-grid"><section><div class="section-title"><h2>Request inbox</h2><span>Stored in this catalog</span></div><ul class="inbox">${requests}</ul></section><section class="product-editor"><div class="section-title"><h2>Add an offer</h2><span>Quote-first by default</span></div><form id="product-form"><label>Name<input name="name" required /></label><label>Description<textarea name="description" required rows="2"></textarea></label><div class="form-grid"><label>Price in cents <span>(blank = POA)</span><input name="price_cents" type="number" min="0" /></label><label>Availability note<input name="stock_note" placeholder="Confirmed on request" /></label></div><p class="form-message" id="product-message" role="status" aria-live="polite"></p><button type="submit">Add offer</button></form><hr><h2>Privacy controls</h2><p>Export or delete all request and contact data in this catalog.</p><button class="danger" id="delete-data" type="button">Delete request data</button></section></section>`, {
    title: 'Owner workspace — Client Request Catalog', description: 'Manage private client links, offers, and incoming requests.', canonical: '/owner'
  });
  for (const [id, endpoint, name] of [['csv', '/api/admin/requests.csv', 'client-requests.csv'], ['pdf', '/api/admin/requests.pdf', 'client-requests.pdf']] as const) {
    ($(`#${id}`) as HTMLAnchorElement).addEventListener('click', async event => { event.preventDefault(); const response = await api(endpoint); if (!response.ok) return window.alert('The export could not be created. Try again.'); const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url); });
  }
  $('#logout').addEventListener('click', () => { sessionStorage.removeItem('crc-owner-code'); ownerCode = ''; loginScreen(); });
  document.querySelectorAll<HTMLSelectElement>('[data-status]').forEach(select => select.addEventListener('change', async () => { const response = await api(`/api/admin/requests/${select.dataset.status}`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) }); if (!response.ok) window.alert('The request status could not be updated. Try again.'); }));
  document.querySelectorAll<HTMLButtonElement>('.copy-client').forEach(button => button.addEventListener('click', async () => { await navigator.clipboard.writeText(button.dataset.url || ''); button.textContent = 'Link copied'; }));
  document.querySelectorAll<HTMLButtonElement>('.revoke-client').forEach(button => button.addEventListener('click', async () => { if (!window.confirm(`Revoke the private link for ${button.dataset.name}? Existing requests stay in the inbox.`)) return; const response = await api(`/api/admin/clients/${button.dataset.client}`, { method: 'DELETE' }); if (response.ok) await loadOwner(); else window.alert('The client link could not be revoked. Try again.'); }));
  $<HTMLFormElement>('#client-form').addEventListener('submit', async event => { event.preventDefault(); const fields = Object.fromEntries(new FormData(event.currentTarget as HTMLFormElement)); const body = { name: String(fields.name), expires_in_days: Number(fields.expires_in_days) }; const response = await api('/api/admin/clients', { method: 'POST', body: JSON.stringify(body) }); if (response.ok) await loadOwner(); else $('#client-message').textContent = 'The private link could not be created. Check the name and expiry.'; });
  $('#product-form').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget as HTMLFormElement; const response = await api('/api/admin/products', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); $('#product-message').textContent = response.ok ? 'Offer added to the catalog.' : 'The offer could not be added. Check each field.'; if (response.ok) window.setTimeout(() => void loadOwner(), 500); });
  $('#delete-data').addEventListener('click', async () => { if (!window.confirm('Delete every request and contact detail? This cannot be undone.')) return; const response = await api('/api/admin/requests', { method: 'DELETE' }); if (response.ok) await loadOwner(); else window.alert('The request data could not be deleted. Try again.'); });
}

function legal(kind: 'privacy' | 'terms') {
  const privacy = kind === 'privacy';
  shell(`<article class="legal"><p class="eyebrow">${privacy ? 'Privacy' : 'Terms'}</p><h1>${privacy ? 'How your request data is handled' : 'Terms for sending a request'}</h1><h2>${privacy ? 'Information stored' : 'This is not a purchase'}</h2><p>${privacy ? 'A submitted request stores your name, email, selected offers, and optional contact details. The business uses that information to reply with a quote.' : 'Sending a request does not create a purchase, reserve stock, or guarantee a price. The business confirms availability and terms directly.'}</p><h2>${privacy ? 'Tracking and outside services' : 'Private links'}</h2><p>${privacy ? 'The app has no analytics, advertising, remote fonts, or tracking scripts. The demo sends sample entries to a non-persistent endpoint.' : 'A private link is an access credential. Do not forward it. The business can revoke it or let it expire.'}</p><h2>${privacy ? 'Export and deletion' : 'Service availability'}</h2><p>${privacy ? 'Ask the business that shared the link to export or delete your request. Owners can export or delete stored request data from the workspace.' : 'The service may reject invalid, excessive, or automated traffic. If a link expires, ask the business for another.'}</p><p><a href="/">Return home</a></p></article>`, {
    title: `${privacy ? 'Privacy' : 'Terms'} — Client Request Catalog`, description: privacy ? 'Learn what a client request stores and how to request deletion.' : 'Read the terms for private catalog links and quote requests.', canonical: `/${kind}`
  });
}
function notFound() { shell('<section class="not-found"><p class="eyebrow">404</p><h1>This page is not in the catalog</h1><p>The link may be incomplete, expired, or mistyped.</p><a class="stamp" href="/">Return home</a></section>', { title: 'Page not found — Client Request Catalog', description: 'This Client Request Catalog page could not be found.', canonical: '/404.html' }); }

if (path === '/') { if (clientToken) void loadCatalog(); else renderLanding(); }
else if (path === '/demo') void loadCatalog();
else if (path === '/owner') void loadOwner();
else if (path === '/privacy' || path === '/terms') legal(path.slice(1) as 'privacy' | 'terms');
else notFound();
