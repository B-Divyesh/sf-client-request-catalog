import { chromium } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFile, writeFile } from "node:fs/promises";

const base = process.argv[2] || "https://client-request-catalog.sociobot.in";
const output = process.argv[3] || ".factory/evidence/polish-2-live.json";
const browser = await chromium.launch();
const results = { base, routes: {}, demo: {}, mobile: {}, focus: {} };

const context = await browser.newContext();
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => pageErrors.push(error.message));

for (const route of ["/", "/demo", "/owner", "/privacy", "/terms", "/missing-page"]) {
  const response = await page.goto(base + route, { waitUntil: "networkidle" });
  const axe = await new AxeBuilder({ page }).analyze();
  results.routes[route] = {
    status: response?.status(),
    title: await page.title(),
    canonical: await page.locator('link[rel="canonical"]').getAttribute("href"),
    ogUrl: await page.locator('meta[property="og:url"]').getAttribute("content"),
    h1: await page.locator("h1").count(),
    main: await page.locator("main").count(),
    seriousCriticalAxe: axe.violations.filter((item) =>
      ["serious", "critical"].includes(item.impact || ""),
    ).length,
  };
}

await page.evaluate(() => {
  localStorage.clear();
  sessionStorage.clear();
});
consoleErrors.length = 0;
pageErrors.length = 0;

const requests = [];
page.on("request", (request) =>
  requests.push({ method: request.method(), origin: new URL(request.url()).origin }),
);
await page.goto(base + "/", { waitUntil: "networkidle" });
await page.getByRole("link", { name: "Try it with sample data" }).click();
await page.waitForLoadState("networkidle");
const oneClickUrl = page.url();
const seeded = {
  offers: await page.locator(".offer-edit-form").count(),
  links: await page.locator(".client-row").count(),
  requests: await page.locator(".inbox-row").count(),
};
const pdfDownloadPromise = page.waitForEvent("download");
await page.getByRole("button", { name: "Export PDF" }).click();
const pdfDownload = await pdfDownloadPromise;
const pdfBytes = await readFile((await pdfDownload.path()));
const pdf = await getDocument({ data: new Uint8Array(pdfBytes) }).promise;
const firstPage = await pdf.getPage(1);
const pdfText = (await firstPage.getTextContent()).items
  .map((item) => ("str" in item ? item.str : ""))
  .join(" ");

await page.getByRole("button", { name: "View sample client catalog" }).click();
await page.locator('.offer[data-id="1"] .add').click();
await page.locator('.offer[data-id="2"] .add').click();
await page.locator('input[name="name"]').fill("Live Sample Client");
await page.locator('input[name="email"]').fill("live-sample@example.test");
await page.locator('input[name="phone"]').fill("+1 555 0110");
await page.locator('input[name="reference"]').fill("LIVE-DEMO-2");
await page.locator('textarea[name="note"]').fill("Sample-only note.");
await page.getByRole("button", { name: /send request/i }).click();
await page.getByRole("button", { name: "Return to sample owner workspace" }).click();
const sampleRow = await page.locator(".inbox-row").first().innerText();
await page.getByRole("button", { name: "Reset demo" }).click();
const resetCount = await page.locator(".inbox-row").count();
const storage = await page.evaluate(async () => ({
  localStorage: Object.keys(localStorage),
  sessionStorage: Object.keys(sessionStorage),
  indexedDb: (await indexedDB.databases()).map((database) => database.name),
}));
const anchorHrefs = await page.locator("a[href]").evaluateAll((anchors) =>
  anchors.map((anchor) => anchor.href),
);
const internalLinkStatuses = [];
for (const href of anchorHrefs) {
  const url = new URL(href);
  if (url.origin !== new URL(base).origin) continue;
  internalLinkStatuses.push({ href, status: (await context.request.get(href)).status() });
}
results.demo = {
  oneClickUrl,
  banner: await page.getByText("Demo — sample data, nothing is saved").isVisible(),
  seeded,
  resetCount,
  sampleRow,
  pdfPages: pdf.numPages,
  pdfHasReference: pdfText.includes("CRC-240731"),
  pdfHasClient: pdfText.includes("Avery Cole"),
  pdfHasOffer: pdfText.includes("Quarterly maintenance visit x 1"),
  protectedExportAnchors: await page.locator('a[href^="/api/admin/"]').count(),
  checkoutControls: await page.locator('a[href*="checkout"],button:has-text("Checkout"),button:has-text("Pay")').count(),
  requestMethods: [...new Set(requests.map((request) => request.method))],
  requestOrigins: [...new Set(requests.map((request) => request.origin))],
  storage,
  internalLinkStatuses,
};

const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mobilePage = await mobileContext.newPage();
await mobilePage.goto(base + "/", { waitUntil: "networkidle" });
results.mobile = await mobilePage.evaluate(() => ({
  headline: document.querySelector("h1")?.textContent?.trim(),
  action: document.querySelector(".stamp")?.textContent?.trim(),
  factsAboveFold: [...document.querySelectorAll(".plain-facts li")].every(
    (item) => item.getBoundingClientRect().bottom <= innerHeight,
  ),
  horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
}));
await mobileContext.close();

await page.goto(base + "/");
await page.getByRole("link", { name: "Privacy" }).first().click();
const privacyFocused = await page.locator("h1").evaluate((heading) => heading === document.activeElement);
await page.goBack();
const homeFocused = await page.locator("h1").evaluate((heading) => heading === document.activeElement);
results.focus = { privacyFocused, homeFocused };
results.consoleErrors = consoleErrors;
results.pageErrors = pageErrors;

await context.close();
await browser.close();

const failures = [
  ...Object.values(results.routes).flatMap((route) => [
    route.h1 !== 1,
    route.main !== 1,
    route.seriousCriticalAxe !== 0,
  ]),
  !results.demo.oneClickUrl.endsWith("/?demo=1"),
  !results.demo.banner,
  results.demo.seeded.offers !== 3,
  results.demo.seeded.links !== 2,
  results.demo.seeded.requests !== 3,
  results.demo.resetCount !== 3,
  results.demo.pdfPages < 1,
  !results.demo.pdfHasReference,
  !results.demo.pdfHasClient,
  !results.demo.pdfHasOffer,
  results.demo.protectedExportAnchors !== 0,
  results.demo.checkoutControls !== 0,
  results.demo.requestMethods.some((method) => method !== "GET"),
  results.demo.requestOrigins.some((origin) => origin !== new URL(base).origin),
  Object.values(results.demo.storage).some((items) => items.length !== 0),
  results.demo.internalLinkStatuses.some((link) => link.status !== 200),
  !results.mobile.factsAboveFold,
  results.mobile.horizontalOverflow,
  !results.focus.privacyFocused,
  !results.focus.homeFocused,
  consoleErrors.length !== 0,
  pageErrors.length !== 0,
].filter(Boolean);

await writeFile(output, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
if (failures.length) process.exit(1);
