import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

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

test("@claim:request-inbox valid browser requests reach the owner inbox", async ({
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
  await page.locator('input[name="name"]').fill("Taylor Requester");
  await page.locator('input[name="email"]').fill("taylor@example.test");
  await page.getByRole("button", { name: /send request/i }).click();
  await expect(page.locator("#form-message")).toContainText(
    /Request CRC-\d{6} is in the inbox/,
  );
});

test("@claim:owner-exports owner exports CSV and PDF", async ({ request }) => {
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
    "reference,name,email,status,created_at,items,note",
  );
  expect(csvText).toContain(reference);
  expect(csvText).toContain("Export Person");
  expect(csvText).toContain("export-person@example.test");
  expect(csvText).toContain("Quarterly maintenance visit x 2");
  const pdf = await request.get("/api/admin/requests.pdf", {
    headers: ownerHeaders(),
  });
  const pdfText = new TextDecoder().decode(await pdf.body());
  expect(pdfText.slice(0, 8)).toBe("%PDF-1.4");
  expect(pdfText).toContain(reference);
  expect(pdfText).toContain("Export Person");
  expect(pdfText).toContain("export-person@example.test");
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
  page.on("request", (request) => origins.add(new URL(request.url()).origin));
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
  await page.locator(".add").first().click();
  await page.locator('input[name="name"]').fill("No Checkout");
  await page.locator('input[name="email"]').fill("no-checkout@example.test");
  await page.getByRole("button", { name: /send request/i }).click();
  await expect(page.locator("#form-message")).toContainText("Sample request");
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
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.addInitScript(() => {
    (window as typeof window & { __crcLongTasks: number }).__crcLongTasks = 0;
    new PerformanceObserver((list) => {
      const measured = list
        .getEntries()
        .reduce((total, entry) => total + Math.max(0, entry.duration - 50), 0);
      (window as typeof window & { __crcLongTasks: number }).__crcLongTasks +=
        measured;
    }).observe({ type: "longtask", buffered: true });
  });
  await page.goto("/");
  await page.waitForTimeout(250);
  const hero = page.locator(".landing-hero img");
  await expect(hero).toBeVisible();
  expect(
    await hero.evaluate(
      (image: HTMLImageElement) => new URL(image.currentSrc).pathname,
    ),
  ).toBe("/assets/request-desk-480.avif");
  const metrics = await page.evaluate(() => ({
    longTaskBlockingMs: (window as typeof window & { __crcLongTasks: number })
      .__crcLongTasks,
    heroBytes: performance
      .getEntriesByType("resource")
      .filter((entry) => entry.name.endsWith("/assets/request-desk-480.avif"))
      .reduce(
        (total, entry) =>
          total + (entry as PerformanceResourceTiming).encodedBodySize,
        0,
      ),
    loadedAuthChunk: performance
      .getEntriesByType("resource")
      .some((entry) => /\/auth-[^/]+\.js$/.test(new URL(entry.name).pathname)),
  }));
  expect(metrics.heroBytes).toBeGreaterThan(0);
  expect(metrics.heroBytes).toBeLessThan(15_000);
  expect(metrics.longTaskBlockingMs).toBeLessThan(100);
  expect(metrics.loadedAuthChunk).toBe(false);
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
