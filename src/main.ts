import { esc, shell } from "./shell";
import "./style.css";

type Product = {
  id: number;
  name: string;
  description: string;
  price_cents: number | null;
  currency: string;
  stock_note: string;
  visible: boolean;
};
type Catalog = {
  business_name: string;
  client_name: string;
  expires_at: string;
  products: Product[];
};
type Item = { product_id: number; quantity: number };
type ClientLink = {
  id: number;
  name: string;
  token: string;
  expires_at: string;
  assigned_product_ids: number[];
};
type InboxRow = {
  id: number;
  reference: string;
  name: string;
  email: string;
  phone?: string;
  client_reference?: string;
  note?: string;
  status: string;
  created_at: string;
  items: string;
};
type OwnerData = {
  business_name: string;
  clients: ClientLink[];
  products: Product[];
  requests: InboxRow[];
  deletion_audit_count: number;
};
type SetupStatus = { claimed: boolean; owned_by_you: boolean };
type ImportRow = {
  name: string;
  description: string;
  price_cents: string;
  stock_note: string;
  error?: string;
};

const $ = <T extends Element>(selector: string) =>
  document.querySelector(selector) as T;
const path = location.pathname;
const query = new URLSearchParams(location.search);
const clientToken = query.get("client") || "";
const demoMode = path === "/demo" || query.get("demo") === "1";
let basket: Item[] = [];
let catalog: Catalog | null = null;
let ownerAccessToken = "";
let ownerAccountLabel = "";
let pendingImport: ImportRow[] = [];
let lastImportedIds: number[] = [];

const freshDemoData = (): OwnerData => ({
  business_name: "North Street Workshop",
  products: [
    {
      id: 1,
      name: "Quarterly maintenance visit",
      description: "A careful on-site check, clean, and adjustment.",
      price_cents: 18500,
      currency: "USD",
      stock_note: "Booked after a suitable time is confirmed.",
      visible: true,
    },
    {
      id: 2,
      name: "Replacement fitting set",
      description: "A matched set prepared for an existing installation.",
      price_cents: null,
      currency: "USD",
      stock_note: "Price and compatibility are confirmed in the quote.",
      visible: true,
    },
    {
      id: 3,
      name: "Repeat consumables pack",
      description: "The usual replenishment pack from a previous order.",
      price_cents: 4200,
      currency: "USD",
      stock_note: "Availability is confirmed before quoting.",
      visible: true,
    },
  ],
  clients: [
    {
      id: 1,
      name: "Avery at North Street",
      token: "sample-avery-private-link",
      expires_at: "2027-03-01T12:00:00Z",
      assigned_product_ids: [1, 2, 3],
    },
    {
      id: 2,
      name: "Morgan at Field House",
      token: "sample-morgan-private-link",
      expires_at: "2027-01-15T12:00:00Z",
      assigned_product_ids: [1, 3],
    },
  ],
  requests: [
    {
      id: 31,
      reference: "CRC-240731",
      name: "Avery Cole",
      email: "avery@example.test",
      phone: "+1 555 0142",
      client_reference: "NSW-184",
      note: "Tuesday mornings work best.",
      status: "new",
      created_at: "2026-09-01T09:20:00Z",
      items: "Quarterly maintenance visit x 1; Replacement fitting set x 1",
    },
    {
      id: 30,
      reference: "CRC-240730",
      name: "Morgan Lee",
      email: "morgan@example.test",
      phone: "+1 555 0188",
      client_reference: "FH-22",
      note: "Please match our last order.",
      status: "quoted",
      created_at: "2026-08-30T15:10:00Z",
      items: "Repeat consumables pack x 2",
    },
    {
      id: 29,
      reference: "CRC-240729",
      name: "Sam Rivera",
      email: "sam@example.test",
      status: "closed",
      created_at: "2026-08-27T11:45:00Z",
      items: "Quarterly maintenance visit x 1",
    },
  ],
  deletion_audit_count: 1,
});
let demoData = freshDemoData();

function money(cents: number | null, currency = "USD") {
  return cents === null
    ? "Price on application"
    : new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
        cents / 100,
      );
}
function api(url: string, init?: RequestInit) {
  return fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(ownerAccessToken
        ? { authorization: `Bearer ${ownerAccessToken}` }
        : {}),
      ...(init?.headers || {}),
    },
  });
}

function renderLanding() {
  shell(
    `<section class="landing-hero"><div><p class="eyebrow">Client Request Catalog</p><h1>Create private catalogs for repeat clients</h1><p class="lede">Small businesses share private prices and collect contact details, selected offers, and notes without checkout.</p><div class="hero-actions"><div class="hero-action"><a class="stamp" href="/?demo=1">Try it with sample data</a><span>One click opens a filled owner workspace.</span></div><a class="button-outline" href="/owner">Set up your catalog</a></div><ul class="plain-facts"><li>Free to use.</li><li>Requires an internet connection.</li><li>No analytics or tracking.</li></ul></div><picture><source type="image/webp" srcset="/assets/request-desk-480.webp 480w, /assets/request-desk.webp 960w" sizes="(max-width: 700px) calc(100vw - 36px), 520px" /><img src="/assets/request-desk-480.webp" width="960" height="640" fetchpriority="high" decoding="async" alt="A blank request slip beside a ruler and spool in two-colour print." /></picture></section><section class="preview" aria-labelledby="preview-title"><div class="section-title"><div><p class="eyebrow">Client view</p><h2 id="preview-title">Show only the offers a client needs</h2></div><p>One catalog can show fixed prices and offers that need a quote.</p></div><div class="preview-lines" aria-label="Sample offer types"><p><strong>Maintenance visit</strong><span>Fixed price</span></p><p><strong>Replacement fitting set</strong><span>Price on application</span></p><p><strong>Repeat supplies</strong><span>Previous order</span></p></div></section><section class="how"><p class="eyebrow">How it works</p><h2>From private client link to request inbox</h2><ol><li><strong>Set your business name.</strong><span>Create the owner workspace with Microsoft sign-in.</span></li><li><strong>Share the catalog.</strong><span>Only people with that private client link can view its prices.</span></li><li><strong>Review requests in the inbox.</strong><span>Contact the client by email outside this app.</span></li></ol></section><section class="limits"><div><p class="eyebrow">Charges and availability</p><h2>This is not a checkout</h2></div><p>It does not charge clients, reserve stock, or create a purchase. The business contacts each client outside this app.</p></section>`,
    {
      title: "Client Request Catalog — share private prices",
      description:
        "Create private client catalogs and collect contact details, selected offers, and notes in one owner inbox.",
      canonical: "/",
    },
  );
}

function itemCount() {
  return basket.reduce((count, item) => count + item.quantity, 0);
}
function renderCatalog() {
  if (!catalog) return;
  const offers = catalog.products.length
    ? catalog.products
        .map(
          (product) =>
            `<article class="offer" data-id="${product.id}"><div><p class="eyebrow">${product.price_cents === null ? "Made to quote" : "Fixed price"}</p><h2>${esc(product.name)}</h2><p>${esc(product.description)}</p><small>${esc(product.stock_note || "Availability is confirmed with the quote.")}</small></div><div class="offer-action"><strong>${money(product.price_cents, product.currency)}</strong><button class="add" data-id="${product.id}" type="button">${product.price_cents === null ? "Request a quote" : "Add to request"}</button></div></article>`,
        )
        .join("")
    : '<section class="empty"><h2>No offers are visible yet</h2><p>Ask the business when its next request window opens.</p></section>';
  const title = demoMode
    ? "Demo — Client Request Catalog"
    : "Private catalog — Client Request Catalog";
  shell(
    `<section class="mast"><div><p class="eyebrow">${demoMode ? "Sample private catalog" : `Private client catalog · expires ${new Date(catalog.expires_at).toLocaleDateString()}`}</p><h1>${esc(catalog.business_name)}<br><em>for ${esc(catalog.client_name)}</em></h1><p class="lede">Select what you need. Fixed prices are marked. Other offers become a quote request. Nothing is charged here.</p><a class="stamp" href="#request">Start a request <span aria-hidden="true">↓</span></a></div><picture><source type="image/webp" srcset="/assets/request-desk-480.webp 480w, /assets/request-desk.webp 960w" sizes="(max-width: 700px) calc(100vw - 36px), 520px" /><img src="/assets/request-desk-480.webp" width="960" height="640" fetchpriority="high" decoding="async" alt="A blank request slip beside a ruler and spool in two-colour print." /></picture></section><section class="catalog-head"><div><p class="eyebrow">Available to you</p><h2>Choose what you need</h2></div><p>${demoMode ? "These prices and offers are fictional sample data." : "Prices and availability are private to this link."}</p></section><section class="offers" aria-label="Available offers">${offers}</section><section id="request" class="request-slip" aria-labelledby="request-title"><div class="slip-heading"><p class="eyebrow">Your request · <span id="count">${itemCount()}</span> item${itemCount() === 1 ? "" : "s"}</p><h2 id="request-title">Prepare your request</h2><p id="basket-copy">${basket.length ? "Your selected offers appear in this request." : "Choose an offer above, then add your contact details."}</p></div><form id="request-form" novalidate><div class="form-grid"><label>Your name<input name="name" autocomplete="name" required aria-describedby="form-message" /></label><label>Email for the quote<input name="email" type="email" autocomplete="email" required aria-describedby="form-message" /></label><label>Phone <span>(optional)</span><input name="phone" type="tel" autocomplete="tel" /></label><label>Reference or PO number <span>(optional)</span><input name="reference" /></label></div><label>Request notes <span>(optional)</span><textarea name="note" rows="3" placeholder="Timing, size, colour, or delivery details"></textarea></label><p id="form-message" class="form-message" role="status" aria-live="polite"></p><button class="submit" type="submit">Send request <span aria-hidden="true">→</span></button></form></section>`,
    {
      title,
      description: demoMode
        ? "Try a complete private request catalog with fictional sample data. Nothing is saved."
        : "Review private prices and send a clear request to the business.",
      canonical: demoMode ? "/demo" : "/",
      demo: demoMode,
    },
  );
  document
    .querySelectorAll<HTMLButtonElement>(".add")
    .forEach((button) =>
      button.addEventListener("click", () =>
        addItem(Number(button.dataset.id)),
      ),
    );
  $<HTMLFormElement>("#request-form").addEventListener("submit", submitRequest);
  $("#reset-demo")?.addEventListener("click", () => {
    demoData = freshDemoData();
    pendingImport = [];
    lastImportedIds = [];
    renderOwner(demoData, true);
  });
}

function addItem(id: number) {
  const found = basket.find((item) => item.product_id === id);
  if (found) found.quantity += 1;
  else basket.push({ product_id: id, quantity: 1 });
  $("#count").textContent = String(itemCount());
  $("#basket-copy").textContent =
    `${itemCount()} item${itemCount() === 1 ? "" : "s"} selected. Add more, or send when ready.`;
  const button = document.querySelector<HTMLButtonElement>(
    `.add[data-id="${id}"]`,
  );
  if (button) {
    button.textContent = "Added ✓";
    window.setTimeout(() => {
      button.textContent =
        catalog?.products.find((product) => product.id === id)?.price_cents ===
        null
          ? "Request a quote"
          : "Add to request";
    }, 900);
  }
}

async function submitRequest(event: SubmitEvent) {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const message = $("#form-message");
  const body = Object.fromEntries(new FormData(form));
  if (
    !String(body.name).trim() ||
    !String(body.email).includes("@") ||
    !basket.length
  ) {
    message.textContent = !basket.length
      ? "Choose at least one offer before sending."
      : "Enter your name and a valid email address.";
    return;
  }
  const button = form.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  )!;
  button.disabled = true;
  button.textContent = "Sending…";
  try {
    if (demoMode) {
      const selected = basket
        .map(
          (item) =>
            `${catalog?.products.find((product) => product.id === item.product_id)?.name || "Offer"} x ${item.quantity}`,
        )
        .join("; ");
      const reference = `DEMO-${String(demoData.requests.length + 421).padStart(4, "0")}`;
      demoData.requests.unshift({
        id: Date.now(),
        reference,
        name: String(body.name),
        email: String(body.email),
        phone: String(body.phone || "") || undefined,
        client_reference: String(body.reference || "") || undefined,
        note: String(body.note || ""),
        status: "new",
        created_at: new Date().toISOString(),
        items: selected,
      });
      basket = [];
      form.reset();
      message.textContent = `Sample request ${reference} added to the sample inbox. Nothing was saved.`;
      return;
    }
    const endpoint = demoMode
      ? "/api/demo/requests"
      : `/api/catalog/${encodeURIComponent(clientToken)}/requests`;
    const response = await api(endpoint, {
      method: "POST",
      body: JSON.stringify({ ...body, items: basket }),
    });
    const data = (await response.json()) as {
      reference?: string;
      error?: string;
    };
    if (!response.ok)
      throw new Error(
        data.error || "The request could not be sent. Try again.",
      );
    basket = [];
    form.reset();
    message.textContent = demoMode
      ? `Sample request ${data.reference} complete. Nothing was saved.`
      : `Request ${data.reference} is in the inbox. The business will reply to ${body.email}.`;
  } catch (error) {
    message.textContent = navigator.onLine
      ? (error as Error).message
      : "You are offline. Reconnect, then send your request.";
  } finally {
    button.disabled = false;
    button.innerHTML = 'Send request <span aria-hidden="true">→</span>';
    $("#count").textContent = "0";
  }
}

async function loadCatalog() {
  const endpoint = demoMode
    ? "/api/demo/catalog"
    : `/api/catalog/${encodeURIComponent(clientToken)}`;
  shell(
    `<section class="loading"><p class="eyebrow">${demoMode ? "Loading sample data" : "Checking private client link"}</p><h1>${demoMode ? "Opening the sample catalog…" : "Opening your private catalog…"}</h1></section>`,
    {
      title: demoMode
        ? "Demo — Client Request Catalog"
        : "Private catalog — Client Request Catalog",
      description: "Open a private request catalog.",
      canonical: demoMode ? "/demo" : "/",
      demo: demoMode,
    },
  );
  try {
    const response = await api(endpoint);
    if (!response.ok)
      throw new Error(
        response.status === 410
          ? "This client link has expired or was revoked."
          : "This catalog could not be opened.",
      );
    catalog = (await response.json()) as Catalog;
    renderCatalog();
  } catch (error) {
    shell(
      `<section class="empty"><p class="eyebrow">Private client link unavailable</p><h1>${esc((error as Error).message)}</h1><p>Check the complete client link, or ask the business to create a new one.</p><button id="retry-catalog" type="button">Try again</button></section>`,
      {
        title: "Link unavailable — Client Request Catalog",
        description: "This private client catalog link is unavailable.",
        canonical: "/",
      },
    );
    $("#retry-catalog").addEventListener("click", () => void loadCatalog());
  }
}

function setupScreen(message = "") {
  shell(
    `<section class="owner-login"><p class="eyebrow">First owner setup</p><h1>Create your private owner workspace</h1><p>Name the business clients will see. Microsoft sign-in protects this workspace.</p><p class="signed-in-as">Signed in as ${esc(ownerAccountLabel)}</p><form id="setup-form"><label>Business name<input name="business_name" maxlength="120" autocomplete="organization" required aria-describedby="setup-message" /></label><p id="setup-message" class="form-message" role="status" aria-live="polite">${esc(message)}</p><button type="submit">Create owner workspace</button></form><p><a class="terms-link" href="/terms">Read request terms</a></p></section>`,
    {
      title: "Set up your catalog — Client Request Catalog",
      description:
        "Create the first owner workspace and business identity for a private request catalog.",
      canonical: "/owner",
    },
  );
  $<HTMLFormElement>("#setup-form").addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();
      const values = new FormData(event.currentTarget as HTMLFormElement);
      const business_name = String(values.get("business_name") || "").trim();
      const messageBox = $("#setup-message");
      if (!business_name) {
        messageBox.textContent = "Enter the business name clients will see.";
        return;
      }
      const response = await api("/api/setup", {
        method: "POST",
        body: JSON.stringify({ business_name }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        messageBox.textContent =
          data.error || "The owner workspace could not be created. Try again.";
        return;
      }
      await loadOwner();
    },
  );
}

function signInScreen(message = "") {
  shell(
    `<section class="owner-login"><p class="eyebrow">Owner workspace</p><h1>Open your private request inbox</h1><p>Use Sociobot Microsoft sign-in to manage client links, offers, and requests.</p><p id="owner-message" class="form-message" role="status" aria-live="polite">${esc(message)}</p><button id="owner-login" type="button">Sign in with Microsoft</button><p><a class="terms-link" href="/terms">Read request terms</a></p></section>`,
    {
      title: "Owner workspace — Client Request Catalog",
      description:
        "Manage private client links, offers, and incoming requests.",
      canonical: "/owner",
    },
  );
  $("#owner-login").addEventListener("click", async () => {
    const button = $("#owner-login") as HTMLButtonElement;
    button.disabled = true;
    button.textContent = "Opening Microsoft sign-in…";
    try {
      await (await import("./auth")).signIn();
    } catch {
      button.disabled = false;
      button.textContent = "Sign in with Microsoft";
      $("#owner-message").textContent =
        "Microsoft sign-in could not open. Try again.";
    }
  });
}

function wrongOwnerScreen() {
  shell(
    `<section class="owner-login"><p class="eyebrow">Owner workspace</p><h1>This workspace has another owner</h1><p>The signed-in Microsoft account cannot open this catalog.</p><button id="logout" type="button">Use another Microsoft account</button></section>`,
    {
      title: "Owner workspace — Client Request Catalog",
      description:
        "Manage private client links, offers, and incoming requests.",
      canonical: "/owner",
    },
  );
  $("#logout").addEventListener("click", () => {
    void import("./auth").then((module) => module.signOut());
  });
}

async function loadOwner() {
  shell(
    '<section class="loading"><h1>Opening your request inbox…</h1></section>',
    {
      title: "Owner workspace — Client Request Catalog",
      description:
        "Manage private client links, offers, and incoming requests.",
      canonical: "/owner",
    },
  );
  try {
    const session = await (await import("./auth")).getOwnerSession();
    if (!session) {
      signInScreen();
      return;
    }
    ownerAccessToken = session.token;
    ownerAccountLabel = session.label;
    const setupResponse = await api("/api/setup");
    const setup = (await setupResponse.json()) as SetupStatus & {
      error?: string;
    };
    if (!setupResponse.ok)
      throw new Error(
        setup.error || "Microsoft sign-in could not be verified.",
      );
    if (!setup.claimed) {
      setupScreen();
      return;
    }
    if (!setup.owned_by_you) {
      wrongOwnerScreen();
      return;
    }
    const response = await api("/api/admin/overview");
    const data = (await response.json()) as OwnerData & { error?: string };
    if (!response.ok)
      throw new Error(data.error || "The inbox could not be opened.");
    renderOwner(data);
  } catch (error) {
    ownerAccessToken = "";
    signInScreen((error as Error).message);
  }
}

function download(response: Response, filename: string) {
  void response.blob().then((blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  });
}

function csvText(rows: InboxRow[]) {
  const quote = (value: unknown) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [
    "reference,name,email,phone,client_reference,status,created_at,items,note",
    ...rows.map((row) =>
      [
        row.reference,
        row.name,
        row.email,
        row.phone,
        row.client_reference,
        row.status,
        row.created_at,
        row.items,
        row.note,
      ]
        .map(quote)
        .join(","),
    ),
  ].join("\n");
}

function downloadBlob(content: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function simplePdf(lines: string[]) {
  let stream = "BT\n/F1 11 Tf\n50 760 Td\n";
  for (const line of lines.slice(0, 42)) {
    const safe = line
      .replaceAll("\\", "\\\\")
      .replaceAll("(", "\\(")
      .replaceAll(")", "\\)")
      .replace(/[^\x20-\x7e]/g, "?");
    stream += `(${safe}) Tj\n0 -16 Td\n`;
  }
  stream += "ET\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets)
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}

function requestPdf(rows: InboxRow[], businessName: string) {
  const lines = [`${businessName} - request inbox`, "Sample export", ""];
  for (const row of rows) {
    lines.push(`${row.reference} - ${row.status} - ${row.name} - ${row.email}`);
    if (row.phone) lines.push(`  Phone: ${row.phone}`);
    if (row.client_reference)
      lines.push(`  Client reference: ${row.client_reference}`);
    lines.push(`  ${row.items}`);
    if (row.note) lines.push(`  Note: ${row.note}`);
    lines.push("");
  }
  return simplePdf(lines);
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

function parseOfferCsv(text: string, products: Product[]) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  const headers = splitCsvLine(lines.shift() || "").map((value) =>
    value.toLowerCase(),
  );
  const required = ["name", "description", "price_cents", "stock_note"];
  if (!required.every((header) => headers.includes(header)))
    return [
      {
        name: "",
        description: "",
        price_cents: "",
        stock_note: "",
        error:
          "Use the template columns: name, description, price_cents, stock_note.",
      },
    ];
  const seen = new Set(
    products.map((product) => product.name.trim().toLowerCase()),
  );
  return lines.map((line, index) => {
    const values = splitCsvLine(line);
    const read = (header: string) => values[headers.indexOf(header)] || "";
    const row: ImportRow = {
      name: read("name"),
      description: read("description"),
      price_cents: read("price_cents"),
      stock_note: read("stock_note"),
    };
    const key = row.name.trim().toLowerCase();
    if (!row.name.trim() || !row.description.trim())
      row.error = `Row ${index + 2}: add a name and description.`;
    else if (
      row.price_cents &&
      (!/^\d+$/.test(row.price_cents) || Number(row.price_cents) > 100_000_000)
    )
      row.error = `Row ${index + 2}: price_cents must be a whole number.`;
    else if (seen.has(key))
      row.error = `Row ${index + 2}: “${row.name}” is a duplicate and will be skipped.`;
    else seen.add(key);
    return row;
  });
}

function renderOwner(data: OwnerData, isDemo = false) {
  const visibleProducts = data.products.filter((product) => product.visible);
  const refresh = () =>
    isDemo ? renderOwner(demoData, true) : void loadOwner();
  const offerChoices = (selected: number[], label: string) =>
    `<fieldset class="offer-assignment"><legend>${esc(label)}</legend>${visibleProducts.length ? visibleProducts.map((product) => `<label><input name="offer_ids" type="checkbox" value="${product.id}" ${selected.includes(product.id) ? "checked" : ""} /><span><strong>${esc(product.name)}</strong><small>${esc(product.description)}</small></span></label>`).join("") : "<p>Add an offer before creating a client link.</p>"}</fieldset>`;
  const requests = data.requests.length
    ? data.requests
        .map(
          (request) =>
            `<li class="inbox-row"><div><strong>${esc(request.reference)}</strong><span class="status ${esc(request.status)}">${esc(request.status)}</span><p>${esc(request.name)} · ${esc(request.email)}${request.phone ? ` · ${esc(request.phone)}` : ""}${request.client_reference ? `<br>Client reference: ${esc(request.client_reference)}` : ""}${request.note ? `<br>${esc(request.note)}` : ""}</p><small>${esc(request.items)}</small></div><div class="request-actions"><time datetime="${esc(request.created_at)}">${new Date(request.created_at).toLocaleDateString()}</time><label class="visually-hidden" for="status-${request.id}">Status for ${esc(request.reference)}</label><select id="status-${request.id}" data-status="${request.id}"><option ${request.status === "new" ? "selected" : ""}>new</option><option ${request.status === "quoted" ? "selected" : ""}>quoted</option><option ${request.status === "closed" ? "selected" : ""}>closed</option></select><button class="button-outline export-request" data-request="${request.id}" type="button">Export this request</button><button class="danger delete-request" data-request="${request.id}" data-reference="${esc(request.reference)}" type="button">Delete this request</button><p class="request-status-message" role="status" aria-live="polite"></p></div></li>`,
        )
        .join("")
    : '<li class="empty"><h3>Your inbox is clear</h3><p>Create and share a private client link to receive requests.</p></li>';
  const clients = data.clients.length
    ? data.clients
        .map((client) => {
          const active = new Date(client.expires_at).getTime() > Date.now();
          const assigned = client.assigned_product_ids.length;
          const url = isDemo
            ? `${location.origin}/?demo=1&view=client`
            : `${location.origin}/?client=${encodeURIComponent(client.token)}`;
          return `<li class="client-row"><div><strong>${esc(client.name)}</strong><span>${active ? `Expires ${new Date(client.expires_at).toLocaleDateString()} · ${assigned} offer${assigned === 1 ? "" : "s"} assigned` : "Revoked or expired"}</span><code>${esc(url)}</code></div><div>${active ? `<button class="copy-client" data-url="${esc(url)}" type="button">Copy link</button><button class="revoke-client danger" data-client="${client.id}" data-name="${esc(client.name)}" type="button">Revoke</button>` : ""}</div>${active ? `<form class="offer-assignment-form" data-client="${client.id}">${offerChoices(client.assigned_product_ids, `Offers visible to ${client.name}`)}<p class="form-message" role="status" aria-live="polite"></p><button type="submit">Save visible offers</button></form>` : ""}</li>`;
        })
        .join("")
    : '<li class="empty"><h3>No client links yet</h3><p>Create a link before sharing any prices.</p></li>';
  const offers = data.products.length
    ? data.products
        .map(
          (product) =>
            `<li class="managed-offer ${product.visible ? "" : "archived"}"><form class="offer-edit-form" data-product="${product.id}"><div class="form-grid"><label>Offer name<input name="name" value="${esc(product.name)}" maxlength="120" required /></label><label>Price in cents <span>(blank = needs a quote)</span><input name="price_cents" type="number" min="0" value="${product.price_cents ?? ""}" /></label></div><label>Description<textarea name="description" rows="2" required>${esc(product.description)}</textarea></label><label>Availability note<input name="stock_note" value="${esc(product.stock_note)}" /></label><p class="offer-state">${product.visible ? "Available in assigned client catalogs" : "Archived and hidden from client catalogs"}</p><div class="offer-controls"><button type="submit">Save offer</button><button class="archive-offer button-outline" data-product="${product.id}" data-visible="${product.visible}" type="button">${product.visible ? "Archive offer" : "Restore offer"}</button><button class="delete-offer danger" data-product="${product.id}" data-name="${esc(product.name)}" type="button">Delete offer</button></div><p class="form-message" role="status" aria-live="polite"></p></form></li>`,
        )
        .join("")
    : '<li class="empty"><h3>No offers yet</h3><p>Add one offer or import a price sheet.</p></li>';
  const modeActions = isDemo
    ? '<button id="view-client" class="button-outline" type="button">View sample client catalog</button>'
    : '<button id="logout" type="button">Lock workspace</button>';
  shell(
    `<section class="owner-head"><div><p class="eyebrow">${isDemo ? "Sample owner workspace" : "Owner workspace"}</p><h1>${esc(data.business_name)}<br><em>request desk</em></h1></div><div class="owner-actions"><button class="button-outline" type="button" id="csv">Export CSV</button><button class="button-outline" type="button" id="pdf">Export PDF</button>${modeActions}</div></section><section class="business-settings" aria-labelledby="business-settings-title"><div><p class="eyebrow">Catalog identity</p><h2 id="business-settings-title">Business name clients see</h2><p>Update this name before sharing a private client link.</p></div><form id="business-form"><label>Business name<input name="business_name" value="${esc(data.business_name)}" maxlength="120" required aria-describedby="business-message" /></label><p id="business-message" class="form-message" role="status" aria-live="polite"></p><button type="submit">Save business name</button></form></section><section class="metrics"><div><strong>${data.requests.filter((request) => request.status === "new").length}</strong><span>New requests</span></div><div><strong>${visibleProducts.length}</strong><span>Available offers</span></div><div><strong>${data.clients.filter((client) => new Date(client.expires_at).getTime() > Date.now()).length}</strong><span>Active client links</span></div></section><section class="offer-manager" aria-labelledby="offers-title"><div class="section-title"><div><p class="eyebrow">Price sheet</p><h2 id="offers-title">Manage offers</h2></div><p>Edit, archive, delete, or import offers.</p></div><ul class="managed-offers">${offers}</ul><div class="offer-tools"><section class="product-editor"><h3>Add one offer</h3><form id="product-form"><label>Name<input name="name" required /></label><label>Description<textarea name="description" required rows="2"></textarea></label><div class="form-grid"><label>Price in cents <span>(blank = needs a quote)</span><input name="price_cents" type="number" min="0" /></label><label>Availability note<input name="stock_note" /></label></div><p class="form-message" id="product-message" role="status" aria-live="polite"></p><button type="submit">Add offer</button></form></section><section class="import-panel"><h3>Import offers from CSV</h3><p>Preview rows before import. Duplicate names are skipped.</p><button id="download-template" class="button-outline" type="button">Download CSV template</button><label>Choose CSV file<input id="offer-csv" type="file" accept=".csv,text/csv" /></label><div id="import-preview" class="import-preview" aria-live="polite"></div><button id="import-offers" type="button" disabled>Import valid offers</button>${lastImportedIds.length ? '<button id="undo-import" class="button-outline" type="button">Undo last import</button>' : ""}</section></div></section><section class="client-manager" aria-labelledby="client-links-title"><div class="section-title"><div><p class="eyebrow">Private access</p><h2 id="client-links-title">Client links and visible offers</h2></div><p>Choose exactly which offers each private client link can open.</p></div><form id="client-form"><div class="form-grid"><label>Client name<input name="name" required maxlength="120" /></label><label>Expires after<input name="expires_in_days" type="number" min="1" max="365" value="90" required /></label></div>${offerChoices(
      visibleProducts.map((product) => product.id),
      "Offers for this new client link",
    )}<p class="form-message" id="client-message" role="status" aria-live="polite"></p><button type="submit">Create private client link</button></form><ul class="client-list">${clients}</ul></section><section class="owner-grid"><section><div class="section-title"><h2>Request inbox</h2><span>Export or delete one request</span></div><ul class="inbox">${requests}</ul></section><section class="product-editor"><h2>Privacy controls</h2><p>Delete one request above. Deletion keeps only an internal request ID, action, and date.</p><p>${data.deletion_audit_count} deletion audit record${data.deletion_audit_count === 1 ? "" : "s"} contain no contact details.</p><button class="danger" id="delete-data" type="button">Delete all request data</button></section></section>`,
    {
      title: isDemo
        ? "Demo — Client Request Catalog"
        : "Owner workspace — Client Request Catalog",
      description: isDemo
        ? "Try a filled owner workspace with sample data that is never saved."
        : "Manage private client links, offers, and incoming requests.",
      canonical: isDemo ? (path === "/demo" ? "/demo" : "/?demo=1") : "/owner",
      demo: isDemo,
    },
  );
  $("#reset-demo")?.addEventListener("click", () => {
    demoData = freshDemoData();
    pendingImport = [];
    lastImportedIds = [];
    renderOwner(demoData, true);
  });
  $("#view-client")?.addEventListener("click", () => renderDemoClient());
  for (const [id, endpoint, name] of [
    ["csv", "/api/admin/requests.csv", "client-requests.csv"],
    ["pdf", "/api/admin/requests.pdf", "client-requests.pdf"],
  ] as const) {
    $<HTMLButtonElement>(`#${id}`).addEventListener("click", async () => {
      if (isDemo)
        downloadBlob(
          id === "csv"
            ? csvText(data.requests)
            : requestPdf(data.requests, data.business_name),
          id === "csv" ? "text/csv" : "application/pdf",
          name,
        );
      else {
        const response = await api(endpoint);
        if (response.ok) download(response, name);
        else window.alert("The export could not be created. Try again.");
      }
    });
  }
  $("#logout")?.addEventListener("click", () => {
    ownerAccessToken = "";
    void import("./auth").then((module) => module.signOut());
  });
  $<HTMLFormElement>("#business-form").addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();
      const name = String(
        new FormData(event.currentTarget as HTMLFormElement).get(
          "business_name",
        ) || "",
      ).trim();
      if (isDemo) {
        demoData.business_name = name;
        refresh();
        return;
      }
      const response = await api("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ business_name: name }),
      });
      const result = (await response.json()) as { error?: string };
      $("#business-message").textContent = response.ok
        ? "Business name saved."
        : result.error || "The business name could not be saved.";
      if (response.ok) window.setTimeout(refresh, 350);
    },
  );
  document
    .querySelectorAll<HTMLSelectElement>("[data-status]")
    .forEach((select) =>
      select.addEventListener("change", async () => {
        const id = Number(select.dataset.status);
        const rowElement = select.closest<HTMLElement>(".inbox-row");
        const badge = rowElement?.querySelector<HTMLElement>(".status");
        const message = rowElement?.querySelector<HTMLElement>(
          ".request-status-message",
        );
        const previousStatus = badge?.textContent?.trim() || "new";
        const nextStatus = select.value;
        select.disabled = true;
        if (isDemo) {
          const row = demoData.requests.find((item) => item.id === id);
          if (row) row.status = nextStatus;
          if (badge) {
            badge.className = `status ${nextStatus}`;
            badge.textContent = nextStatus;
          }
          if (message) message.textContent = `Status saved as ${nextStatus}.`;
          select.disabled = false;
          return;
        }
        const response = await api(`/api/admin/requests/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus }),
        });
        if (response.ok) {
          if (badge) {
            badge.className = `status ${nextStatus}`;
            badge.textContent = nextStatus;
          }
          if (message) message.textContent = `Status saved as ${nextStatus}.`;
        } else {
          select.value = previousStatus;
          if (message)
            message.textContent =
              "The request status could not be updated. Try again.";
        }
        select.disabled = false;
      }),
    );
  document
    .querySelectorAll<HTMLButtonElement>(".copy-client")
    .forEach((button) =>
      button.addEventListener("click", async () => {
        await navigator.clipboard.writeText(button.dataset.url || "");
        button.textContent = "Link copied";
      }),
    );
  document
    .querySelectorAll<HTMLButtonElement>(".revoke-client")
    .forEach((button) =>
      button.addEventListener("click", async () => {
        if (
          !window.confirm(
            `Revoke the private client link for ${button.dataset.name}? Existing requests stay in the inbox.`,
          )
        )
          return;
        const id = Number(button.dataset.client);
        if (isDemo) {
          const client = demoData.clients.find((item) => item.id === id);
          if (client) client.expires_at = "2020-01-01T00:00:00Z";
          refresh();
          return;
        }
        const response = await api(`/api/admin/clients/${id}`, {
          method: "DELETE",
        });
        if (response.ok) refresh();
        else window.alert("The client link could not be revoked. Try again.");
      }),
    );
  document
    .querySelectorAll<HTMLFormElement>(".offer-assignment-form")
    .forEach((form) =>
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const product_ids = [
          ...form.querySelectorAll<HTMLInputElement>(
            'input[name="offer_ids"]:checked',
          ),
        ].map((input) => Number(input.value));
        const id = Number(form.dataset.client);
        if (isDemo) {
          const client = demoData.clients.find((item) => item.id === id);
          if (client) client.assigned_product_ids = product_ids;
          refresh();
          return;
        }
        const response = await api(`/api/admin/clients/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ product_ids }),
        });
        if (response.ok) refresh();
        else
          form.querySelector<HTMLElement>(".form-message")!.textContent =
            "The visible offers could not be saved.";
      }),
    );
  $<HTMLFormElement>("#client-form").addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const fields = new FormData(form);
      const body = {
        name: String(fields.get("name")),
        expires_in_days: Number(fields.get("expires_in_days")),
        offer_ids: [
          ...form.querySelectorAll<HTMLInputElement>(
            'input[name="offer_ids"]:checked',
          ),
        ].map((input) => Number(input.value)),
      };
      if (isDemo) {
        demoData.clients.unshift({
          id: Date.now(),
          name: body.name,
          token: "sample-new-link",
          expires_at: new Date(
            Date.now() + body.expires_in_days * 86400000,
          ).toISOString(),
          assigned_product_ids: body.offer_ids,
        });
        refresh();
        return;
      }
      const response = await api("/api/admin/clients", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (response.ok) refresh();
      else
        $("#client-message").textContent =
          "The private client link could not be created. Check the name, expiry, and offers.";
    },
  );
  $<HTMLFormElement>("#product-form").addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const fields = Object.fromEntries(new FormData(form));
      if (isDemo) {
        demoData.products.unshift({
          id: Date.now(),
          name: String(fields.name),
          description: String(fields.description),
          price_cents: fields.price_cents ? Number(fields.price_cents) : null,
          currency: "USD",
          stock_note: String(fields.stock_note || ""),
          visible: true,
        });
        refresh();
        return;
      }
      const response = await api("/api/admin/products", {
        method: "POST",
        body: JSON.stringify(fields),
      });
      $("#product-message").textContent = response.ok
        ? "Offer added."
        : "The offer could not be added. Check each field.";
      if (response.ok) window.setTimeout(refresh, 350);
    },
  );
  document
    .querySelectorAll<HTMLFormElement>(".offer-edit-form")
    .forEach((form) =>
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const id = Number(form.dataset.product);
        const fields = Object.fromEntries(new FormData(form));
        if (isDemo) {
          const product = demoData.products.find((item) => item.id === id);
          if (product)
            Object.assign(product, {
              name: String(fields.name),
              description: String(fields.description),
              price_cents: fields.price_cents
                ? Number(fields.price_cents)
                : null,
              stock_note: String(fields.stock_note || ""),
            });
          refresh();
          return;
        }
        const response = await api(`/api/admin/products/${id}`, {
          method: "PATCH",
          body: JSON.stringify(fields),
        });
        if (response.ok) refresh();
        else
          form.querySelector<HTMLElement>(".form-message")!.textContent =
            "The offer could not be saved.";
      }),
    );
  document
    .querySelectorAll<HTMLButtonElement>(".archive-offer")
    .forEach((button) =>
      button.addEventListener("click", async () => {
        const id = Number(button.dataset.product);
        const visible = button.dataset.visible !== "true";
        if (isDemo) {
          const product = demoData.products.find((item) => item.id === id);
          if (product) product.visible = visible;
          refresh();
          return;
        }
        const response = await api(`/api/admin/products/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ visible }),
        });
        if (response.ok) refresh();
        else window.alert("The offer could not be archived.");
      }),
    );
  document
    .querySelectorAll<HTMLButtonElement>(".delete-offer")
    .forEach((button) =>
      button.addEventListener("click", async () => {
        if (
          !window.confirm(
            `Delete “${button.dataset.name}”? Offers used in requests must be archived instead.`,
          )
        )
          return;
        const id = Number(button.dataset.product);
        if (isDemo) {
          demoData.products = demoData.products.filter(
            (item) => item.id !== id,
          );
          demoData.clients.forEach((client) => {
            client.assigned_product_ids = client.assigned_product_ids.filter(
              (item) => item !== id,
            );
          });
          refresh();
          return;
        }
        const response = await api(`/api/admin/products/${id}`, {
          method: "DELETE",
        });
        if (response.ok) refresh();
        else
          window.alert(
            response.status === 409
              ? "This offer appears in a request. Archive it to preserve that request."
              : "The offer could not be deleted.",
          );
      }),
    );
  $("#download-template").addEventListener("click", () =>
    downloadBlob(
      "name,description,price_cents,stock_note\nSeasonal inspection,Inspect and adjust the existing installation,9500,Dates confirmed after request\nCustom repair,Repair quoted after inspection,,Price confirmed in quote\n",
      "text/csv",
      "offer-import-template.csv",
    ),
  );
  $<HTMLInputElement>("#offer-csv").addEventListener(
    "change",
    async (event) => {
      const file = (event.currentTarget as HTMLInputElement).files?.[0];
      pendingImport = file
        ? parseOfferCsv(await file.text(), data.products)
        : [];
      const valid = pendingImport.filter((row) => !row.error);
      $("#import-preview").innerHTML = pendingImport.length
        ? `<p>${valid.length} valid row${valid.length === 1 ? "" : "s"} ready.</p><ul>${pendingImport.map((row) => `<li class="${row.error ? "import-error" : ""}">${esc(row.error || `${row.name} — ${row.price_cents || "needs a quote"}`)}</li>`).join("")}</ul>`
        : "<p>No rows found.</p>";
      $<HTMLButtonElement>("#import-offers").disabled = valid.length === 0;
    },
  );
  $("#import-offers").addEventListener("click", async () => {
    const rows = pendingImport.filter((row) => !row.error);
    if (!rows.length) return;
    if (isDemo) {
      lastImportedIds = rows.map((row, index) => Date.now() + index);
      rows.forEach((row, index) =>
        demoData.products.unshift({
          id: lastImportedIds[index],
          name: row.name,
          description: row.description,
          price_cents: row.price_cents ? Number(row.price_cents) : null,
          currency: "USD",
          stock_note: row.stock_note,
          visible: true,
        }),
      );
      pendingImport = [];
      refresh();
      return;
    }
    const response = await api("/api/admin/products/import", {
      method: "POST",
      body: JSON.stringify({ products: rows }),
    });
    const result = (await response.json()) as { ids?: number[] };
    if (response.ok) {
      lastImportedIds = result.ids || [];
      pendingImport = [];
      refresh();
    } else
      $("#import-preview").textContent =
        "The valid rows could not be imported. Try again.";
  });
  $("#undo-import")?.addEventListener("click", async () => {
    if (isDemo) {
      demoData.products = demoData.products.filter(
        (product) => !lastImportedIds.includes(product.id),
      );
      lastImportedIds = [];
      refresh();
      return;
    }
    for (const id of lastImportedIds)
      await api(`/api/admin/products/${id}`, { method: "DELETE" });
    lastImportedIds = [];
    refresh();
  });
  document
    .querySelectorAll<HTMLButtonElement>(".export-request")
    .forEach((button) =>
      button.addEventListener("click", async () => {
        const id = Number(button.dataset.request);
        if (isDemo) {
          const row = data.requests.filter((item) => item.id === id);
          downloadBlob(csvText(row), "text/csv", "request-export.csv");
          return;
        }
        const response = await api(`/api/admin/requests/${id}.csv`);
        if (response.ok) download(response, "request-export.csv");
        else
          window.alert("The request export could not be created. Try again.");
      }),
    );
  document
    .querySelectorAll<HTMLButtonElement>(".delete-request")
    .forEach((button) =>
      button.addEventListener("click", async () => {
        if (
          !window.confirm(
            `Delete request ${button.dataset.reference}? Contact details and selected offers will be removed.`,
          )
        )
          return;
        const id = Number(button.dataset.request);
        if (isDemo) {
          demoData.requests = demoData.requests.filter((row) => row.id !== id);
          demoData.deletion_audit_count += 1;
          refresh();
          return;
        }
        const response = await api(`/api/admin/requests/${id}`, {
          method: "DELETE",
        });
        if (response.ok) refresh();
        else window.alert("The request could not be deleted. Try again.");
      }),
    );
  $("#delete-data").addEventListener("click", async () => {
    if (
      !window.confirm(
        "Delete every request and contact detail? This cannot be undone.",
      )
    )
      return;
    if (isDemo) {
      demoData.deletion_audit_count += demoData.requests.length;
      demoData.requests = [];
      refresh();
      return;
    }
    const response = await api("/api/admin/requests", { method: "DELETE" });
    if (response.ok) refresh();
    else window.alert("The request data could not be deleted. Try again.");
  });
}

function renderDemoClient() {
  const client = demoData.clients.find(
    (item) => new Date(item.expires_at).getTime() > Date.now(),
  )!;
  catalog = {
    business_name: demoData.business_name,
    client_name: client?.name || "Sample client",
    expires_at: client?.expires_at || "2027-01-01T00:00:00Z",
    products: demoData.products.filter(
      (product) =>
        product.visible &&
        (!client || client.assigned_product_ids.includes(product.id)),
    ),
  };
  basket = [];
  renderCatalog();
  const main = $("#main");
  const switcher = document.createElement("div");
  switcher.className = "demo-view-switch";
  switcher.innerHTML =
    '<button id="view-owner" class="button-outline" type="button">Return to sample owner workspace</button>';
  main.prepend(switcher);
  $("#view-owner").addEventListener("click", () => renderOwner(demoData, true));
}

function legal(kind: "privacy" | "terms") {
  const privacy = kind === "privacy";
  const body = privacy
    ? "<h2>Information stored</h2><p>A submitted request stores your name, email, phone, reference, note, and selected offers. The business contacts you outside this app.</p><h2>Tracking and outside services</h2><p>No page loads analytics, advertising, remote fonts, or tracking scripts. The demo keeps sample changes only in browser memory.</p><p>Owner sign-in uses the Sociobot Microsoft Entra External ID tenant. Microsoft handles the owner account and sign-in session.</p><h2>Export and deletion</h2><p>Ask the business that shared the private client link to export or delete your request. The owner can export that request alone or delete it without exposing other clients. Deletion keeps only an internal request ID, action, and date.</p>"
    : "<h2>This is not a purchase</h2><p>Sending a request does not charge you, create a purchase, or reserve stock. The business contacts you outside this app.</p><h2>Private client links</h2><p>A private client link grants access to its catalog. Do not forward it. The business can revoke it or let it expire.</p><h2>Acceptable use</h2><p>Send genuine requests through a link shared with you. If a link expires, ask the business for another.</p>";
  shell(
    `<article class="legal"><p class="eyebrow">${privacy ? "Privacy" : "Terms"}</p><h1>${privacy ? "How your request data is handled" : "Terms for sending a request"}</h1>${body}<p><a href="/">Return home</a></p></article>`,
    {
      title: `${privacy ? "Privacy" : "Terms"} — Client Request Catalog`,
      description: privacy
        ? "Learn what a client request stores and how to request deletion."
        : "Read the terms for private catalog links and quote requests.",
      canonical: `/${kind}`,
    },
  );
}
function notFound() {
  shell(
    '<section class="not-found"><p class="eyebrow">404</p><h1>This page is not in the catalog</h1><p>The link may be incomplete, expired, or mistyped.</p><a class="stamp" href="/">Return home</a></section>',
    {
      title: "Page not found — Client Request Catalog",
      description: "This Client Request Catalog page could not be found.",
      canonical: "/404.html",
    },
  );
}

if (demoMode) {
  if (query.get("view") === "client") renderDemoClient();
  else renderOwner(demoData, true);
} else if (path === "/") {
  if (clientToken) void loadCatalog();
  else renderLanding();
} else if (path === "/owner" || path === "/auth/callback") void loadOwner();
else if (path === "/privacy" || path === "/terms")
  legal(path.slice(1) as "privacy" | "terms");
else notFound();
