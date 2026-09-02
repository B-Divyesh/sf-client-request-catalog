import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const authToken = "e2e-test-entra-token";
let ip = 100;
const ownerHeaders = () => ({
  authorization: `Bearer ${authToken}`,
  "x-forwarded-for": "198.51.100." + ip++,
});
const clientIp = (page: Page, suffix: number) =>
  page.setExtraHTTPHeaders({ "x-forwarded-for": "198.51.100." + suffix });
const authenticateOwnerPage = (page: Page) =>
  page.addInitScript(
    (token) => sessionStorage.setItem("crc-test-auth-token", token),
    authToken,
  );

async function ensureWorkspace(request: APIRequestContext) {
  const status = await request.get("/api/setup", { headers: ownerHeaders() });
  if (!((await status.json()) as { claimed: boolean }).claimed) {
    expect(
      (
        await request.post("/api/setup", {
          headers: ownerHeaders(),
          data: { business_name: "E2E Repair Catalog" },
        })
      ).status(),
    ).toBe(200);
  }
  const overview = await request.get("/api/admin/overview", {
    headers: ownerHeaders(),
  });
  const products = (await overview.json()).products as unknown[];
  for (let index = products.length; index < 3; index += 1) {
    expect(
      (
        await request.post("/api/admin/products", {
          headers: ownerHeaders(),
          data: {
            name: [
              "Quarterly maintenance visit",
              "Replacement fitting set",
              "Repeat consumables pack",
            ][index],
            description: "Test offer " + (index + 1),
            price_cents: index === 1 ? "" : "4200",
          },
        })
      ).status(),
    ).toBe(200);
  }
}

async function extractPdfText(bytes: Uint8Array) {
  const document = await getDocument({ data: new Uint8Array(bytes) }).promise;
  const pages: string[] = [];
  for (let number = 1; number <= document.numPages; number += 1) {
    const page = await document.getPage(number);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" "),
    );
  }
  return { pageCount: document.numPages, text: pages.join("\n") };
}

test("@claim:one-click-owner-demo landing opens a filled isolated owner workspace in one click", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Try it with sample data" }).click();
  await expect(page).toHaveURL(/\?demo=1$/);
  await expect(
    page.getByText("Demo — sample data, nothing is saved"),
  ).toBeVisible();
  await expect(page.locator(".offer-edit-form")).toHaveCount(3);
  await expect(page.locator(".client-row")).toHaveCount(2);
  await expect(page.locator(".inbox-row")).toHaveCount(3);
  await page
    .locator(".offer-edit-form")
    .first()
    .locator('input[name="name"]')
    .fill("Edited sample visit");
  await page
    .locator(".offer-edit-form")
    .first()
    .getByRole("button", { name: "Save offer" })
    .click();
  await expect(
    page.locator('input[value="Edited sample visit"]'),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(
    page.locator('input[value="Quarterly maintenance visit"]'),
  ).toBeVisible();
});

test("@claim:mixed-price-modes one sample request contains fixed and needs-a-quote offers", async ({
  page,
}) => {
  await page.goto("/?demo=1");
  await page
    .getByRole("button", { name: "View sample client catalog" })
    .click();
  await page.locator('.offer[data-id="1"] .add').click();
  await page.locator('.offer[data-id="2"] .add').click();
  await page.locator('input[name="name"]').fill("Mixed Mode Client");
  await page.locator('input[name="email"]').fill("mixed@example.test");
  await page.getByRole("button", { name: /send request/i }).click();
  await expect(page.locator("#form-message")).toContainText(
    "added to the sample inbox",
  );
  await page
    .getByRole("button", { name: "Return to sample owner workspace" })
    .click();
  await expect(page.locator(".inbox-row").first()).toContainText(
    "Quarterly maintenance visit x 1; Replacement fitting set x 1",
  );
});

test("@claim:offer-maintenance owners can edit, archive, restore, and delete offers", async ({
  page,
}) => {
  await page.goto("/?demo=1");
  const first = page.locator(".offer-edit-form").first();
  await first.locator('input[name="name"]').fill("Updated maintenance visit");
  await first.getByRole("button", { name: "Save offer" }).click();
  await expect(
    page.locator('input[value="Updated maintenance visit"]'),
  ).toBeVisible();
  await page
    .locator(".offer-edit-form")
    .first()
    .getByRole("button", { name: "Archive offer" })
    .click();
  await expect(page.locator(".managed-offer.archived")).toHaveCount(1);
  await page
    .locator(".managed-offer.archived")
    .getByRole("button", { name: "Restore offer" })
    .click();
  await expect(page.locator(".managed-offer.archived")).toHaveCount(0);
  await page
    .locator('#product-form input[name="name"]')
    .fill("Temporary sample offer");
  await page
    .locator('#product-form textarea[name="description"]')
    .fill("Created only for this demo.");
  await page
    .locator("#product-form")
    .getByRole("button", { name: "Add offer" })
    .click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .locator(".offer-edit-form")
    .filter({ has: page.locator('input[value="Temporary sample offer"]') })
    .getByRole("button", { name: "Delete offer" })
    .click();
  await expect(
    page.locator('input[value="Temporary sample offer"]'),
  ).toHaveCount(0);
});

test("@claim:csv-offer-import CSV import previews validation, skips duplicates, imports rows, and can be undone", async ({
  page,
}) => {
  await page.goto("/?demo=1");
  await page.locator("#offer-csv").setInputFiles({
    name: "offers.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "name,description,price_cents,stock_note\nQuarterly maintenance visit,Duplicate,100,Skip this\nWindow hardware check,Inspect catches and hinges,6800,Dates confirmed\nCustom timber repair,Measure before quoting,,Price confirmed later\n",
    ),
  });
  await expect(page.locator("#import-preview")).toContainText(
    "2 valid rows ready",
  );
  await expect(page.locator("#import-preview")).toContainText(
    "duplicate and will be skipped",
  );
  await page.getByRole("button", { name: "Import valid offers" }).click();
  await expect(
    page.locator('input[value="Window hardware check"]'),
  ).toBeVisible();
  await expect(
    page.locator('input[value="Custom timber repair"]'),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo last import" }).click();
  await expect(
    page.locator('input[value="Window hardware check"]'),
  ).toHaveCount(0);
});

test("@claim:free-access @claim:online-required first-screen price and connection facts are accurate", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await expect(page.locator(".plain-facts")).toContainText("Free to use.");
  await expect(
    page.locator('a[href*="checkout"], [data-subscription-checkout]'),
  ).toHaveCount(0);
  await expect(page.locator(".plain-facts")).toContainText(
    "Requires an internet connection.",
  );
  const context = await browser.newContext();
  await context.setOffline(true);
  const offlinePage = await context.newPage();
  await expect(offlinePage.goto("http://127.0.0.1:8123/")).rejects.toThrow();
  await context.close();
});

test("@claim:owner-onboarding first-run setup brands a real catalog", async ({
  page,
  request,
}) => {
  expect(
    (
      await request.get("/api/setup", {
        headers: { "x-forwarded-for": "198.51.100.1" },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await (
        await request.get("/api/setup", { headers: ownerHeaders() })
      ).json()
    ).claimed,
  ).toBe(false);
  await authenticateOwnerPage(page);
  await page.goto("/demo");
  await expect(
    page.getByRole("link", { name: "Set up your catalog" }),
  ).toHaveAttribute("href", "/owner");
  await page.getByRole("link", { name: "Set up your catalog" }).click();
  await expect(
    page.getByRole("heading", { name: "Create your private owner workspace" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in with Microsoft" }),
  ).toHaveCount(0);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.locator('input[name="offer_ids"]')).toHaveCount(0);
  await page.locator('input[name="business_name"]').fill("Cedar Repair Co.");
  await page.getByRole("button", { name: "Create owner workspace" }).click();
  await page
    .locator('#product-form input[name="name"]')
    .fill("Quarterly maintenance visit");
  await page
    .locator('#product-form textarea[name="description"]')
    .fill("A careful service visit.");
  await page.getByRole("button", { name: "Add offer" }).click();
  await expect(
    page.getByText("Quarterly maintenance visit").last(),
  ).toBeVisible();
  await page
    .locator('#client-form input[name="name"]')
    .fill("June at Acorn House");
  await page.locator('#client-form input[name="offer_ids"]').check();
  await page
    .locator("#client-form")
    .getByRole("button", { name: "Create private client link" })
    .click();
  const overview = await request.get("/api/admin/overview", {
    headers: ownerHeaders(),
  });
  const created = (
    (await overview.json()).clients as Array<{ name: string; token: string }>
  ).find((client) => client.name === "June at Acorn House")!;
  await page
    .locator('#business-form input[name="business_name"]')
    .fill("Cedar Home Repair");
  await page.getByRole("button", { name: "Save business name" }).click();
  await expect
    .poll(
      async () =>
        (
          await (
            await request.get("/api/catalog/" + created.token, {
              headers: { "x-forwarded-for": "198.51.100.2" },
            })
          ).json()
        ).business_name,
    )
    .toBe("Cedar Home Repair");
});

test("real owner offer lifecycle preserves referenced requests and removes unused offers", async ({
  request,
}) => {
  await ensureWorkspace(request);
  const created = await request.post("/api/admin/products", {
    headers: ownerHeaders(),
    data: {
      name: "Temporary fitting",
      description: "Original wording",
      price_cents: "2500",
      stock_note: "In stock",
    },
  });
  expect(created.status()).toBe(200);
  const overview = await (
    await request.get("/api/admin/overview", { headers: ownerHeaders() })
  ).json();
  const offer = overview.products.find(
    (item: { name: string }) => item.name === "Temporary fitting",
  );
  expect(
    (
      await request.patch(`/api/admin/products/${offer.id}`, {
        headers: ownerHeaders(),
        data: {
          name: "Updated fitting",
          description: "Corrected wording",
          price_cents: "2750",
          stock_note: "Confirm before ordering",
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.patch(`/api/admin/products/${offer.id}`, {
        headers: ownerHeaders(),
        data: { visible: false },
      })
    ).status(),
  ).toBe(200);
  let updated = await (
    await request.get("/api/admin/overview", { headers: ownerHeaders() })
  ).json();
  expect(
    updated.products.find((item: { id: number }) => item.id === offer.id),
  ).toMatchObject({
    name: "Updated fitting",
    price_cents: 2750,
    visible: false,
  });
  expect(
    (
      await request.patch(`/api/admin/products/${offer.id}`, {
        headers: ownerHeaders(),
        data: { visible: true },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.delete(`/api/admin/products/${offer.id}`, {
        headers: ownerHeaders(),
      })
    ).status(),
  ).toBe(200);
  updated = await (
    await request.get("/api/admin/overview", { headers: ownerHeaders() })
  ).json();
  expect(
    updated.products.some((item: { id: number }) => item.id === offer.id),
  ).toBe(false);
  const imported = await request.post("/api/admin/products/import", {
    headers: ownerHeaders(),
    data: {
      products: [
        {
          name: "Imported bronze latch",
          description: "Matched to the existing fitting.",
          price_cents: "3600",
          stock_note: "Two-week lead time",
        },
        {
          name: "Quarterly maintenance visit",
          description: "Duplicate name",
          price_cents: "1",
          stock_note: "",
        },
      ],
    },
  });
  expect(imported.status()).toBe(200);
  const importResult = (await imported.json()) as {
    ids: number[];
    skipped: string[];
  };
  expect(importResult.ids).toHaveLength(1);
  expect(importResult.skipped).toEqual(["Quarterly maintenance visit"]);
  expect(
    (
      await request.delete(`/api/admin/products/${importResult.ids[0]}`, {
        headers: ownerHeaders(),
      })
    ).status(),
  ).toBe(200);
  const usedOffer = await request.post("/api/admin/products", {
    headers: ownerHeaders(),
    data: {
      name: "Referenced repair",
      description: "Must remain in request history",
      price_cents: "",
      stock_note: "",
    },
  });
  expect(usedOffer.status()).toBe(200);
  const afterCreate = await (
    await request.get("/api/admin/overview", { headers: ownerHeaders() })
  ).json();
  const usedId = afterCreate.products.find(
    (item: { name: string }) => item.name === "Referenced repair",
  ).id;
  const client = await request.post("/api/admin/clients", {
    headers: ownerHeaders(),
    data: {
      name: "Lifecycle client",
      expires_in_days: 30,
      offer_ids: [usedId],
    },
  });
  const token = ((await client.json()) as { token: string }).token;
  expect(
    (
      await request.post(`/api/catalog/${token}/requests`, {
        headers: { "x-forwarded-for": "198.51.100.122" },
        data: {
          name: "Lifecycle Person",
          email: "lifecycle@example.test",
          items: [{ product_id: usedId, quantity: 1 }],
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.delete(`/api/admin/products/${usedId}`, {
        headers: ownerHeaders(),
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await request.patch(`/api/admin/products/${usedId}`, {
        headers: ownerHeaders(),
        data: { visible: false },
      })
    ).status(),
  ).toBe(200);
});

test("@claim:demo-isolated sample requests never enter the real inbox", async ({
  page,
  request,
}) => {
  await ensureWorkspace(request);
  const before = (
    await (
      await request.get("/api/admin/overview", { headers: ownerHeaders() })
    ).json()
  ).requests.length;
  const paths: string[] = [];
  page.on("request", (item) => paths.push(new URL(item.url()).pathname));
  await clientIp(page, 11);
  await page.goto("/demo");
  await page
    .getByRole("button", { name: "View sample client catalog" })
    .click();
  await page.locator(".add").first().click();
  await page.locator('input[name="name"]').fill("Jordan Example");
  await page.locator('input[name="email"]').fill("jordan@example.test");
  await page.getByRole("button", { name: /send request/i }).click();
  await expect(page.locator("#form-message")).toContainText(
    "Nothing was saved",
  );
  expect(paths.some((value) => value.startsWith("/api/demo/"))).toBe(false);
  expect(paths.some((value) => value.startsWith("/api/catalog/"))).toBe(false);
  expect(
    (
      await (
        await request.get("/api/admin/overview", { headers: ownerHeaders() })
      ).json()
    ).requests.length,
  ).toBe(before);
});

test("@claim:private-prices opaque links hide and revoke prices", async ({
  page,
  request,
}) => {
  await ensureWorkspace(request);
  await page.goto("/");
  await expect(page.locator(".offer")).toHaveCount(0);
  const made = await request.post("/api/admin/clients", {
    headers: ownerHeaders(),
    data: { name: "Regression Client", expires_in_days: 30, offer_ids: [1] },
  });
  const link = (await made.json()) as { id: number; token: string };
  expect(link.token).toMatch(/^[A-Za-z0-9]{40}$/);
  expect(
    (
      await (
        await request.get("/api/catalog/" + link.token, {
          headers: { "x-forwarded-for": "198.51.100.12" },
        })
      ).json()
    ).products,
  ).toHaveLength(1);
  expect(
    (
      await request.get("/api/catalog/" + link.token, {
        headers: {
          "x-forwarded-for": "198.51.100.120",
          "x-test-now": "2099-01-01T00:00:00Z",
        },
      })
    ).status(),
  ).toBe(410);
  expect(
    (
      await request.delete("/api/admin/clients/" + link.id, {
        headers: ownerHeaders(),
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.get("/api/catalog/" + link.token, {
        headers: { "x-forwarded-for": "198.51.100.13" },
      })
    ).status(),
  ).toBe(410);
});

test("@claim:request-inbox @claim:request-data-stored valid browser requests reach the owner inbox with every disclosed field", async ({
  page,
  request,
}) => {
  await ensureWorkspace(request);
  const made = await request.post("/api/admin/clients", {
    headers: ownerHeaders(),
    data: { name: "North Street", expires_in_days: 30, offer_ids: [1] },
  });
  const token = ((await made.json()) as { token: string }).token;
  await clientIp(page, 14);
  await page.goto("/?client=" + token);
  await page.locator(".add").first().click();
  await page.locator(".add").first().click();
  await page.locator('input[name="name"]').fill("Taylor Requester");
  await page.locator('input[name="email"]').fill("taylor@example.test");
  await page.locator('input[name="phone"]').fill("+1 555 0199");
  await page.locator('input[name="reference"]').fill("TAYLOR-PO-44");
  await page
    .locator('textarea[name="note"]')
    .fill("Please call before the visit.");
  await page.getByRole("button", { name: /send request/i }).click();
  await expect(page.locator("#form-message")).toContainText(
    /Request CRC-\d{6} is in the inbox/,
  );
  const receipt = await page.locator("#form-message").textContent();
  const reference = receipt?.match(/CRC-\d{6}/)?.[0];
  expect(reference).toBeTruthy();
  const storedReference = reference!;
  const overview = await (
    await request.get("/api/admin/overview", { headers: ownerHeaders() })
  ).json();
  const stored = overview.requests.find(
    (row: { reference: string }) => row.reference === storedReference,
  );
  expect(stored).toMatchObject({
    reference: storedReference,
    name: "Taylor Requester",
    email: "taylor@example.test",
    phone: "+1 555 0199",
    client_reference: "TAYLOR-PO-44",
    note: "Please call before the visit.",
    status: "new",
    items: "Quarterly maintenance visit x 2",
  });

  const database = new DatabaseSync(
    join("/tmp/client-request-catalog-e2e", "catalog-live.sqlite"),
    { readOnly: true },
  );
  try {
    const columns = database
      .prepare("PRAGMA table_info(requests)")
      .all()
      .map((column) => (column as { name: string }).name);
    expect(columns).toEqual([
      "id",
      "reference",
      "client_id",
      "name",
      "email",
      "phone",
      "client_reference",
      "note",
      "status",
      "created_at",
    ]);
    const row = database
      .prepare(
        "SELECT reference,name,email,phone,client_reference,note,status FROM requests WHERE reference=?",
      )
      .get(storedReference) as Record<string, unknown>;
    expect(row).toEqual({
      reference: storedReference,
      name: "Taylor Requester",
      email: "taylor@example.test",
      phone: "+1 555 0199",
      client_reference: "TAYLOR-PO-44",
      note: "Please call before the visit.",
      status: "new",
    });
    const item = database
      .prepare(
        "SELECT ri.quantity,p.name FROM request_items ri JOIN products p ON p.id=ri.product_id JOIN requests r ON r.id=ri.request_id WHERE r.reference=?",
      )
      .get(storedReference) as Record<string, unknown>;
    expect(item).toEqual({
      quantity: 2,
      name: "Quarterly maintenance visit",
    });
  } finally {
    database.close();
  }
});

test("@claim:owner-exports owner exports CSV and PDF", async ({
  page,
  request,
}) => {
  await ensureWorkspace(request);
  const client = await request.post("/api/admin/clients", {
    headers: ownerHeaders(),
    data: { name: "Export Client", expires_in_days: 30, offer_ids: [1] },
  });
  const token = ((await client.json()) as { token: string }).token;
  const created = await request.post("/api/catalog/" + token + "/requests", {
    headers: { "x-forwarded-for": "198.51.100.121" },
    data: {
      name: "Export Person",
      email: "export-person@example.test",
      reference: "EXPORT-PO-7",
      items: [{ product_id: 1, quantity: 2 }],
    },
  });
  expect(created.status()).toBe(200);
  const reference = ((await created.json()) as { reference: string }).reference;
  const csv = await request.get("/api/admin/requests.csv", {
    headers: ownerHeaders(),
  });
  const csvText = await csv.text();
  expect(csvText).toContain(
    "reference,name,email,phone,client_reference,status,created_at,items,note",
  );
  expect(csvText).toContain(reference);
  expect(csvText).toContain("Export Person");
  expect(csvText).toContain("export-person@example.test");
  expect(csvText).toContain("Quarterly maintenance visit x 2");
  const pdf = await request.get("/api/admin/requests.pdf", {
    headers: ownerHeaders(),
  });
  const parsedRealPdf = await extractPdfText(await pdf.body());
  expect(parsedRealPdf.pageCount).toBeGreaterThanOrEqual(1);
  expect(parsedRealPdf.text).toContain(reference);
  expect(parsedRealPdf.text).toContain("Export Person");
  expect(parsedRealPdf.text).toContain("export-person@example.test");
  expect(parsedRealPdf.text).toContain("Quarterly maintenance visit x 2");

  await page.goto("/?demo=1");
  const csvDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const csvDownload = await csvDownloadPromise;
  const demoCsv = await readFile((await csvDownload.path())!, "utf8");
  expect(demoCsv).toContain("CRC-240731");
  expect(demoCsv).toContain("Avery Cole");
  expect(demoCsv).toContain("Quarterly maintenance visit x 1");

  const pdfDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF" }).click();
  const pdfDownload = await pdfDownloadPromise;
  const parsedDemoPdf = await extractPdfText(
    await readFile((await pdfDownload.path())!),
  );
  expect(parsedDemoPdf.pageCount).toBeGreaterThanOrEqual(1);
  expect(parsedDemoPdf.text).toContain("CRC-240731");
  expect(parsedDemoPdf.text).toContain("Avery Cole");
  expect(parsedDemoPdf.text).toContain("Quarterly maintenance visit x 1");
});

test("@claim:request-status-updates owner status changes are announced and persist", async ({
  page,
  request,
}) => {
  await ensureWorkspace(request);
  const made = await request.post("/api/admin/clients", {
    headers: ownerHeaders(),
    data: { name: "Status Client", expires_in_days: 30, offer_ids: [1] },
  });
  const token = ((await made.json()) as { token: string }).token;
  const created = await request.post(`/api/catalog/${token}/requests`, {
    headers: { "x-forwarded-for": "198.51.100.87" },
    data: {
      name: "Status Requester",
      email: "status@example.test",
      items: [{ product_id: 1, quantity: 1 }],
    },
  });
  expect(created.status()).toBe(200);
  const reference = ((await created.json()) as { reference: string }).reference;

  await authenticateOwnerPage(page);
  await clientIp(page, 88);
  await page.goto("/owner");
  const requestRow = page.locator(".inbox-row").filter({ hasText: reference });
  await expect(requestRow).toBeVisible();
  await requestRow.locator("select[data-status]").selectOption("quoted");
  await expect(requestRow.locator(".request-status-message")).toHaveText(
    "Status saved as quoted.",
  );
  await expect(requestRow.locator(".status")).toHaveText("quoted");
  await expect
    .poll(async () => {
      const overview = await (
        await request.get("/api/admin/overview", { headers: ownerHeaders() })
      ).json();
      return overview.requests.find(
        (row: { reference: string }) => row.reference === reference,
      )?.status;
    })
    .toBe("quoted");

  await page.reload();
  const reloadedRow = page.locator(".inbox-row").filter({ hasText: reference });
  await expect(reloadedRow.locator("select[data-status]")).toHaveValue(
    "quoted",
  );
  await expect(reloadedRow.locator(".status")).toHaveText("quoted");
});

test("@claim:client-offer-visibility each client link has its assigned offers", async ({
  request,
}) => {
  await ensureWorkspace(request);
  const alpha = await request.post("/api/admin/clients", {
    headers: ownerHeaders(),
    data: { name: "Alpha", expires_in_days: 30, offer_ids: [1] },
  });
  const beta = await request.post("/api/admin/clients", {
    headers: ownerHeaders(),
    data: { name: "Beta", expires_in_days: 30, offer_ids: [2] },
  });
  const alphaToken = ((await alpha.json()) as { token: string }).token;
  const betaToken = ((await beta.json()) as { token: string }).token;
  expect(
    (
      await (
        await request.get("/api/catalog/" + alphaToken, {
          headers: { "x-forwarded-for": "198.51.100.15" },
        })
      ).json()
    ).products.map((product: { id: number }) => product.id),
  ).toEqual([1]);
  expect(
    (
      await (
        await request.get("/api/catalog/" + betaToken, {
          headers: { "x-forwarded-for": "198.51.100.16" },
        })
      ).json()
    ).products.map((product: { id: number }) => product.id),
  ).toEqual([2]);
});

test("@claim:individual-request-privacy @claim:deletion-audit-minimal one-request export and deletion retain only audit fields", async ({
  request,
}) => {
  await ensureWorkspace(request);
  const headers = ownerHeaders();
  const client = await request.post("/api/admin/clients", {
    headers,
    data: { name: "Privacy", expires_in_days: 30, offer_ids: [1] },
  });
  const token = ((await client.json()) as { token: string }).token;
  for (const [email, suffix] of [
    ["first@example.test", "17"],
    ["second@example.test", "18"],
  ] as const) {
    expect(
      (
        await request.post("/api/catalog/" + token + "/requests", {
          headers: { "x-forwarded-for": "198.51.100." + suffix },
          data: {
            name: "Requester",
            email,
            items: [{ product_id: 1, quantity: 1 }],
          },
        })
      ).status(),
    ).toBe(200);
  }
  const rows = (
    await (await request.get("/api/admin/overview", { headers })).json()
  ).requests as Array<{ id: number; email: string }>;
  const first = rows.find((row) => row.email === "first@example.test")!;
  const second = rows.find((row) => row.email === "second@example.test")!;
  expect(
    await (
      await request.get("/api/admin/requests/" + first.id + ".csv", { headers })
    ).text(),
  ).toContain("first@example.test");
  expect(
    (
      await request.delete("/api/admin/requests/" + first.id, { headers })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.get("/api/admin/requests/" + first.id + ".csv", { headers })
    ).status(),
  ).toBe(404);
  expect(
    (
      await (await request.get("/api/admin/overview", { headers })).json()
    ).requests.some((row: { id: number }) => row.id === second.id),
  ).toBe(true);
  const audit = (
    (await (
      await request.get("/api/admin/deletion-audit", { headers })
    ).json()) as Array<Record<string, unknown>>
  ).find((row) => row.request_id === first.id)!;
  expect(Object.keys(audit).sort()).toEqual([
    "action",
    "deleted_at",
    "request_id",
  ]);
  expect(JSON.stringify(audit)).not.toContain("first@example.test");
});

test("operator-gated checkout is not advertised", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-subscription-checkout]")).toHaveCount(0);
  await expect(
    page.locator('a[href*="api.sociobot.in/api/v1/products"]'),
  ).toHaveCount(0);
  await expect(
    page.getByText(/\$12 a month|Start monthly plan|Sociobot checkout/i),
  ).toHaveCount(0);
  await page.goto("/terms");
  await expect(
    page.locator('a[href*="api.sociobot.in/api/v1/products"]'),
  ).toHaveCount(0);
  await expect(
    page.getByText(/\$12 a month|Start monthly plan|Sociobot checkout/i),
  ).toHaveCount(0);
});

test("@claim:generated-art-disclosure footer discloses the generated illustration", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("footer")).toContainText(
    "Original illustration generated with Azure AI Foundry.",
  );
});

test("@claim:no-trackers and @claim:no-checkout use no third-party request", async ({
  page,
  request,
}) => {
  await ensureWorkspace(request);
  const made = await request.post("/api/admin/clients", {
    headers: ownerHeaders(),
    data: { name: "Tracker audit", expires_in_days: 30, offer_ids: [1] },
  });
  const token = ((await made.json()) as { token: string }).token;
  const origins = new Set<string>();
  const methods: string[] = [];
  page.on("request", (request) => {
    origins.add(new URL(request.url()).origin);
    methods.push(request.method());
  });
  await page.goto("/");
  await page.goto("/demo");
  await page.goto("/privacy");
  await page.goto("/terms");
  await page.goto("/missing-page");
  await authenticateOwnerPage(page);
  await page.goto("/owner");
  await expect(
    page.getByRole("heading", { name: /request desk/i }),
  ).toBeVisible();
  await page.goto("/?client=" + token);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Tracker audit",
  );
  await page.goto("/demo");
  await page
    .getByRole("button", { name: "View sample client catalog" })
    .click();
  const offersBefore = await page.locator(".offer").allTextContents();
  await page.locator('.offer[data-id="1"] .add').click();
  await page.locator('.offer[data-id="2"] .add').click();
  await page.locator('input[name="name"]').fill("No Checkout");
  await page.locator('input[name="email"]').fill("no-checkout@example.test");
  await page.getByRole("button", { name: /send request/i }).click();
  await expect(page.locator("#form-message")).toContainText("Sample request");
  await expect(
    page.locator(
      'a[href*="checkout"], a[href*="payment"], button:has-text("Pay"), button:has-text("Checkout"), [data-purchase], [data-reservation]',
    ),
  ).toHaveCount(0);
  await page.waitForTimeout(1_000);
  expect(await page.locator(".offer").allTextContents()).toEqual(offersBefore);
  await page
    .getByRole("button", { name: "Return to sample owner workspace" })
    .click();
  const sampleRequest = page.locator(".inbox-row").first();
  await expect(sampleRequest).toContainText("Quarterly maintenance visit x 1");
  await expect(sampleRequest).toContainText("Replacement fitting set x 1");
  await expect(sampleRequest).not.toContainText(/purchase|reserved|charged/i);
  expect(methods.every((method) => method === "GET")).toBe(true);
  expect([...origins]).toEqual(["http://127.0.0.1:8123"]);
});

test("@claim:entra-owner-auth owner identity uses Sociobot Entra and mobile terms target is at least 44px", async ({
  page,
  request,
}) => {
  const configResponse = await request.get("/api/auth/config", {
    headers: { "x-forwarded-for": "198.51.100.81" },
  });
  expect(configResponse.status()).toBe(200);
  const config = (await configResponse.json()) as {
    authority: string;
    client_id: string;
    redirect_uri: string;
  };
  expect(config).toMatchObject({
    authority:
      "https://sociobotcustomers.ciamlogin.com/35c6fe40-0ec0-46b6-98c6-213ad4de6650/",
    client_id: "25c704f4-465a-47af-80ab-2c489466b697",
    redirect_uri: "/auth/callback",
  });
  const unauthorized = await request.get("/api/admin/overview", {
    headers: {
      "x-owner-passphrase": "legacy local password",
      "x-forwarded-for": "198.51.100.82",
    },
  });
  expect(unauthorized.status()).toBe(401);
  expect(unauthorized.headers()["www-authenticate"]).toBe("Bearer");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/owner");
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Sign in with Microsoft" }),
  ).toBeVisible();
  const termsBox = await page
    .getByRole("link", { name: "Read request terms" })
    .boundingBox();
  expect(termsBox).not.toBeNull();
  expect(termsBox!.width).toBeGreaterThanOrEqual(44);
  expect(termsBox!.height).toBeGreaterThanOrEqual(44);

  const outbound = page.waitForRequest(
    (item) =>
      new URL(item.url()).hostname === "sociobotcustomers.ciamlogin.com",
  );
  await page.getByRole("button", { name: "Sign in with Microsoft" }).click();
  const requestToEntra = await outbound;
  expect(requestToEntra.url()).toContain(
    "/35c6fe40-0ec0-46b6-98c6-213ad4de6650/",
  );
});

test("mobile landing uses the small hero and keeps auth work off the main route", async ({
  browser,
}, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL);
  const samples: Array<{
    longTaskBlockingMs: number;
    heroBytes: number;
    heroPath: string;
    loadedAuthChunk: boolean;
  }> = [];

  for (let sample = 0; sample < 7; sample += 1) {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 390, height: 844 },
    });
    try {
      const page = await context.newPage();
      const session = await context.newCDPSession(page);
      await session.send("Network.setCacheDisabled", { cacheDisabled: true });
      await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await page.addInitScript(() => {
        (window as typeof window & { __crcLongTasks: number }).__crcLongTasks =
          0;
        new PerformanceObserver((list) => {
          const measured = list
            .getEntries()
            .reduce(
              (total, entry) => total + Math.max(0, entry.duration - 50),
              0,
            );
          (
            window as typeof window & { __crcLongTasks: number }
          ).__crcLongTasks += measured;
        }).observe({ type: "longtask", buffered: true });
      });
      await page.goto("/", { waitUntil: "load" });
      await page.waitForTimeout(250);
      const hero = page.locator(".landing-hero img");
      await expect(hero).toBeVisible();
      samples.push(
        await page.evaluate(() => {
          const resources = performance.getEntriesByType(
            "resource",
          ) as PerformanceResourceTiming[];
          const heroImage = document.querySelector<HTMLImageElement>(
            ".landing-hero img",
          )!;
          return {
            longTaskBlockingMs: (
              window as typeof window & { __crcLongTasks: number }
            ).__crcLongTasks,
            heroBytes: resources
              .filter((entry) =>
                entry.name.endsWith("/assets/request-desk-480.avif"),
              )
              .reduce((total, entry) => total + entry.encodedBodySize, 0),
            heroPath: new URL(heroImage.currentSrc).pathname,
            loadedAuthChunk: resources.some((entry) =>
              /\/auth-[^/]+\.js$/.test(new URL(entry.name).pathname),
            ),
          };
        }),
      );
    } finally {
      await context.close();
    }
  }

  for (const sample of samples) {
    expect(sample.heroPath).toBe("/assets/request-desk-480.avif");
    expect(sample.heroBytes).toBeGreaterThan(0);
    expect(sample.heroBytes).toBeLessThan(15_000);
    expect(sample.loadedAuthChunk).toBe(false);
  }
  const sortedBlocking = samples
    .map((sample) => sample.longTaskBlockingMs)
    .sort((left, right) => left - right);
  const medianBlockingMs = sortedBlocking[Math.floor(sortedBlocking.length / 2)];
  testInfo.annotations.push({
    type: "performance",
    description: `4x CPU cold-sample blocking: ${sortedBlocking.map(Math.round).join(", ")} ms; median ${Math.round(medianBlockingMs)} ms`,
  });
  expect(medianBlockingMs).toBeLessThan(100);
});

test("browser Back and Forward restore focus and announce the restored route heading", async ({
  page,
}) => {
  await page.goto("/");
  const landingHeading = page.getByRole("heading", { level: 1 });
  await expect(landingHeading).toHaveText(
    "Create private catalogs for repeat clients",
  );

  await page.getByRole("link", { name: "Privacy" }).first().click();
  const privacyHeading = page.getByRole("heading", { level: 1 });
  await expect(privacyHeading).toBeFocused();

  await page.goBack();
  await expect(landingHeading).toBeFocused();
  await expect(page.locator(".route-announcer")).toHaveText(
    (await landingHeading.textContent()) || "",
  );

  await page.goForward();
  await expect(privacyHeading).toBeFocused();
  await expect(page.locator(".route-announcer")).toHaveText(
    (await privacyHeading.textContent()) || "",
  );
});

test("every visible internal link resolves and exports are buttons", async ({
  page,
  request,
}) => {
  let suffix = 150;
  for (const route of ["/", "/?demo=1", "/owner", "/privacy", "/terms"]) {
    await page.goto(route);
    const links = await page.locator("a[href]").evaluateAll((anchors) =>
      anchors.map((anchor) => (anchor as HTMLAnchorElement).href),
    );
    for (const href of links) {
      const url = new URL(href);
      if (url.origin !== "http://127.0.0.1:8123") continue;
      const response = await request.get(url.pathname + url.search, {
        headers: { "x-forwarded-for": `198.51.100.${suffix++}` },
      });
      expect(response.status(), `${route} links to ${url.pathname}`).toBe(200);
    }
  }
  await page.goto("/?demo=1");
  await expect(page.locator('a[href^="/api/admin/"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export PDF" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export this request" }),
  ).toHaveCount(3);
});

test("desktop/mobile keyboard, accessibility, offline, metadata and limits pass", async ({
  page,
  request,
  browser,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
  expect(
    await page
      .locator(".plain-facts li")
      .evaluateAll((items) =>
        items.every(
          (item) => item.getBoundingClientRect().bottom <= window.innerHeight,
        ),
      ),
  ).toBe(true);
  await page.getByRole("link", { name: "Privacy" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  for (const route of ["/demo", "/owner", "/privacy", "/terms"]) {
    await page.goto(route);
    const audit = await new AxeBuilder({ page }).analyze();
    expect(
      audit.violations.filter((item) =>
        ["serious", "critical"].includes(item.impact || ""),
      ).length,
    ).toBe(0);
  }
  expect(
    (
      await request.get("/definitely-not-a-real-route", {
        headers: { "x-forwarded-for": "198.51.100.19" },
      })
    ).status(),
  ).toBe(404);
  const publicResponses = await Promise.all(
    Array.from({ length: 45 }, () =>
      request.get("/api/demo/catalog", {
        headers: { "x-forwarded-for": "203.0.113.90" },
      }),
    ),
  );
  expect(
    publicResponses.some(
      (response) =>
        response.status() === 429 && response.headers()["retry-after"] === "1",
    ),
  ).toBe(true);
  const ownerResponses = await Promise.all(
    Array.from({ length: 9 }, () =>
      request.get("/api/admin/not-a-route", {
        headers: { "x-forwarded-for": "203.0.113.91" },
      }),
    ),
  );
  expect(
    ownerResponses.some(
      (response) =>
        response.status() === 429 && response.headers()["retry-after"] === "1",
    ),
  ).toBe(true);
  const context = await browser.newContext();
  const offline = await context.newPage();
  await offline.goto("/demo");
  await offline
    .getByRole("button", { name: "View sample client catalog" })
    .click();
  await offline.locator(".add").first().click();
  await offline.locator('input[name="name"]').fill("Offline");
  await offline.locator('input[name="email"]').fill("offline@example.test");
  await context.setOffline(true);
  await offline.getByRole("button", { name: /send request/i }).click();
  await expect(offline.locator("#form-message")).toContainText(
    "Nothing was saved",
  );
  await context.close();
});

test("route metadata uses each real URL and private titles stay bounded", async ({
  page,
  request,
}) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const route of ["/", "/demo", "/owner", "/privacy", "/terms"])
    expect(sitemap).toContain(
      `<loc>https://client-request-catalog.sociobot.in${route}</loc>`,
    );
  for (const route of [
    "/",
    "/demo",
    "/owner",
    "/privacy",
    "/terms",
    "/missing-page",
  ]) {
    await page.goto(route);
    const expectedPath = route === "/missing-page" ? "/404.html" : route;
    expect(
      await page.locator('meta[property="og:url"]').getAttribute("content"),
    ).toBe(`https://client-request-catalog.sociobot.in${expectedPath}`);
    expect((await page.title()).length).toBeLessThanOrEqual(60);
  }
  await ensureWorkspace(request);
  const longName = "A".repeat(120);
  expect(
    (
      await request.patch("/api/admin/settings", {
        headers: ownerHeaders(),
        data: { business_name: longName },
      })
    ).status(),
  ).toBe(200);
  const made = await request.post("/api/admin/clients", {
    headers: ownerHeaders(),
    data: { name: "Long title client", expires_in_days: 30, offer_ids: [1] },
  });
  const token = ((await made.json()) as { token: string }).token;
  await page.goto("/?client=" + token);
  expect(await page.title()).toBe("Private catalog — Client Request Catalog");
  expect((await page.title()).length).toBeLessThanOrEqual(60);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(longName);
  await request.patch("/api/admin/settings", {
    headers: ownerHeaders(),
    data: { business_name: "E2E Repair Catalog" },
  });
});
