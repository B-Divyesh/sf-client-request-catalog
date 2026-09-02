const app = document.querySelector<HTMLElement>("#app")!;

export function esc(value: unknown) {
  const node = document.createElement("div");
  node.textContent = String(value ?? "");
  return node.innerHTML;
}

function setMeta(title: string, description: string, canonicalPath: string) {
  document.title = title;
  const values: Array<[string, string, string]> = [
    ["name", "description", description],
    ["property", "og:title", title],
    ["property", "og:description", description],
    [
      "property",
      "og:image",
      "https://client-request-catalog.sociobot.in/assets/og-request-desk.webp",
    ],
    ["property", "og:type", "website"],
    [
      "property",
      "og:url",
      `https://client-request-catalog.sociobot.in${canonicalPath}`,
    ],
    ["name", "twitter:card", "summary_large_image"],
    ["name", "twitter:title", title],
    ["name", "twitter:description", description],
  ];
  for (const [attribute, key, content] of values) {
    let meta = document.head.querySelector<HTMLMetaElement>(
      `meta[${attribute}="${key}"]`,
    );
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute(attribute, key);
      document.head.append(meta);
    }
    meta.content = content;
  }
  let canonical = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.append(canonical);
  }
  canonical.href = `https://client-request-catalog.sociobot.in${canonicalPath}`;
}

function focusAndAnnounceRouteHeading() {
  const heading = document.querySelector<HTMLHeadingElement>("main h1");
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus();
  const announcer = document.querySelector<HTMLElement>(".route-announcer");
  if (!announcer) return;
  const announcement = heading.textContent?.trim() || document.title;
  announcer.textContent = "";
  requestAnimationFrame(() => {
    announcer.textContent = announcement;
  });
}

function focusRouteHeading() {
  if (sessionStorage.getItem("crc-focus-heading") !== "1") return;
  sessionStorage.removeItem("crc-focus-heading");
  requestAnimationFrame(focusAndAnnounceRouteHeading);
}

function restoreRouteFocus() {
  sessionStorage.removeItem("crc-focus-heading");
  requestAnimationFrame(focusAndAnnounceRouteHeading);
}

window.addEventListener("pagehide", () => {
  sessionStorage.setItem("crc-focus-heading", "1");
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) restoreRouteFocus();
});
window.addEventListener("popstate", () => {
  if (!location.hash) restoreRouteFocus();
});
document.addEventListener("click", (event) => {
  const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
  if (
    link &&
    link.origin === location.origin &&
    link.pathname !== location.pathname
  )
    sessionStorage.setItem("crc-focus-heading", "1");
});

export function shell(
  content: string,
  options: {
    title: string;
    description: string;
    canonical: string;
    demo?: boolean;
  },
) {
  setMeta(options.title, options.description, options.canonical);
  const banner = options.demo
    ? '<aside class="demo-banner" aria-label="Demo status"><strong>Demo — sample data, nothing is saved</strong><span><button id="reset-demo" type="button">Reset demo</button><a href="/owner">Set up your catalog</a></span></aside>'
    : "";
  const responsiveHeroSources =
    '<source type="image/avif" srcset="/assets/request-desk-480.avif 480w, /assets/request-desk-720.avif 720w, /assets/request-desk-960.avif 960w" sizes="(max-width: 700px) calc(100vw - 36px), 520px" /><source type="image/webp" srcset="/assets/request-desk-480.webp 480w, /assets/request-desk-720.webp 720w, /assets/request-desk.webp 960w" sizes="(max-width: 700px) calc(100vw - 36px), 520px" />';
  const optimizedContent = content.replace(
    /<source type="image\/webp" srcset="\/assets\/request-desk-480\.webp 480w, \/assets\/request-desk\.webp 960w" sizes="[^"]+" \/>/g,
    responsiveHeroSources,
  );
  app.innerHTML = `<header class="site-head"><a class="wordmark" href="/" aria-label="Client Request Catalog home">CLIENT REQUEST<br><i>CATALOG</i></a><nav aria-label="Primary"><a href="/?demo=1">Demo</a><a href="/owner">Owner workspace</a><a href="/privacy">Privacy</a></nav></header>${banner}<main id="main" tabindex="-1">${optimizedContent}</main><footer><span>Private request catalogs for small businesses · Version 1.4</span><span>Original illustration generated with Azure AI Foundry.</span><span><a href="/privacy">Privacy</a><a href="/terms">Terms</a><span>Built by Param Factory</span></span></footer><div class="route-announcer" role="status" aria-live="polite" aria-atomic="true"></div>`;
  focusRouteHeading();
}
