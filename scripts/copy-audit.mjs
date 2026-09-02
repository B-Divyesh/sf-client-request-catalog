import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const root = new URL("../", import.meta.url);
const outputUrl = new URL(".factory/copy-audit.md", root);
const banned = [
  "leverage",
  "seamless",
  "effortless",
  "robust",
  "powerful",
  "intuitive",
  "reimagine",
  "supercharge",
  "unlock",
  "delightful",
  "journey",
  "ecosystem",
  "AI-powered",
];

const clean = (value) => value.replace(/\s+/g, " ").trim();
const words = (value) =>
  value.match(/[A-Za-z0-9]+(?:[-’'][A-Za-z0-9]+)*/g)?.length ?? 0;
const escapeCell = (value) => value.replaceAll("|", "\\|");
const flag = (value) => {
  const issues = [];
  if (words(value) > 22) issues.push("over 22 words");
  const lower = value.toLowerCase();
  for (const term of banned)
    if (lower.includes(term.toLowerCase())) issues.push(`banned: ${term}`);
  return issues.length ? issues.join(", ") : "—";
};
const table = (values) => [
  "| Copy | Words | Flag |",
  "| --- | ---: | --- |",
  ...values.map(
    (value) =>
      `| ${escapeCell(value)} | ${words(value)} | ${escapeCell(flag(value))} |`,
  ),
].join("\n");

async function waitForServer(child) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error("Vite preview stopped early");
    try {
      if ((await fetch("http://127.0.0.1:4179/")).ok) return;
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Vite preview did not start");
}

const preview = spawn("./node_modules/.bin/vite", ["preview", "--host", "127.0.0.1", "--port", "4179"], {
  cwd: new URL(".", root),
  stdio: "ignore",
});

try {
  await waitForServer(preview);
  const browser = await chromium.launch({ headless: true });
  let landing;
  let metadata;
  try {
    const page = await browser.newPage();
    await page.goto("http://127.0.0.1:4179/");
    landing = await page.evaluate(() => {
      const selectors = [
        ".wordmark",
        "header nav a",
        "main .eyebrow",
        "main h1",
        "main h2",
        ".landing-hero .lede",
        ".hero-action > a",
        ".hero-action > span",
        ".hero-actions > .button-outline",
        ".plain-facts li",
        ".section-title > p",
        ".preview-lines strong",
        ".preview-lines span",
        ".how li strong",
        ".how li span",
        ".limits > p",
        "footer > span:not(:last-child)",
        "footer a",
      ];
      return [...document.querySelectorAll(selectors.join(","))]
        .map((node) =>
          (node instanceof HTMLElement ? node.innerText : node.textContent || "")
            .replace(/\s+/g, " ")
            .trim(),
        )
        .filter((value, index, all) => value && all.indexOf(value) === index);
    });
    metadata = await page.evaluate(() => ({
      title: document.title,
      description:
        document.querySelector('meta[name="description"]')?.getAttribute("content") || "",
    }));
  } finally {
    await browser.close();
  }

  const readme = await readFile(new URL("README.md", root), "utf8");
  const readmeCopy = readme
    .split(/\n\s*\n/)
    .filter((block) => !block.startsWith("#") && !block.startsWith("    "))
    .flatMap((block) => block.replace(/\n/g, " ").split(/(?<=[.!?])\s+(?=[A-Z`])/))
    .map((sentence) => clean(sentence.replaceAll("`", "")));
  const catalog = clean(
    await readFile(new URL(".factory/catalog-description.txt", root), "utf8"),
  );
  const sections = [
    "# Copy audit",
    "",
    "Generated from the built landing DOM, route metadata, README, and catalog description. Run `npm run audit:copy:update` after copy changes. `npm run test:e2e` fails when this file is stale.",
    "",
    "## Landing page",
    "",
    table(landing),
    "",
    "## Metadata",
    "",
    table([metadata.title, metadata.description]),
    "",
    "## README",
    "",
    table(readmeCopy),
    "",
    "## Catalog description",
    "",
    table([catalog]),
    "",
    "## Terminology",
    "",
    "| Concept | Term |",
    "| --- | --- |",
    "| Link that grants catalog access | private client link, then client link |",
    "| Business-only screen | owner workspace |",
    "| Item offered by the business | offer |",
    "| Client submission | request |",
    "| List of received requests | request inbox |",
    "",
  ];
  const generated = sections.join("\n");
  const hasFlags = [...landing, metadata.title, metadata.description, ...readmeCopy, catalog]
    .some((value) => flag(value) !== "—");
  if (hasFlags) throw new Error("Copy audit found a banned term or a sentence over 22 words");
  if (process.argv.includes("--update")) {
    await writeFile(outputUrl, generated);
  } else {
    const committed = await readFile(outputUrl, "utf8");
    if (committed !== generated)
      throw new Error(".factory/copy-audit.md is stale; run npm run audit:copy:update");
  }
} finally {
  preview.kill("SIGTERM");
}
