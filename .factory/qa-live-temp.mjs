import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const base = 'https://client-request-catalog.sociobot.in';
const browser = await chromium.launch();
const results = {};

async function auditPage(path, options = {}) {
  const context = await browser.newContext({
    viewport: options.viewport || { width: 1440, height: 900 },
    colorScheme: options.colorScheme || 'light',
    reducedMotion: options.reducedMotion || 'no-preference',
  });
  const page = await context.newPage();
  const requests = [];
  const responses = [];
  const consoleErrors = [];
  const pageErrors = [];
  page.on('request', request => requests.push({ method: request.method(), url: request.url() }));
  page.on('response', response => responses.push({ status: response.status(), url: response.url() }));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(error.message));
  const response = await page.goto(base + path, { waitUntil: 'networkidle' });
  const axe = await new AxeBuilder({ page }).analyze();
  const data = await page.evaluate(() => {
    const all = selector => Array.from(document.querySelectorAll(selector));
    const targetSizes = all('a,button,input,textarea,select').map(element => {
      const r = element.getBoundingClientRect();
      return { tag: element.tagName, text: (element.textContent || element.getAttribute('aria-label') || element.getAttribute('name') || '').trim().slice(0, 60), width: Math.round(r.width), height: Math.round(r.height) };
    });
    return {
      title: document.title,
      lang: document.documentElement.lang,
      description: document.querySelector('meta[name="description"]')?.getAttribute('content') || null,
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || null,
      ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content') || null,
      favicon: document.querySelector('link[rel~="icon"]')?.getAttribute('href') || null,
      h1s: all('h1').map(x => x.textContent.trim()),
      mains: all('main').length,
      headers: all('header').length,
      footers: all('footer').length,
      images: all('img').map(img => ({ src: img.getAttribute('src'), alt: img.getAttribute('alt'), width: img.getAttribute('width'), height: img.getAttribute('height') })),
      headings: all('h1,h2,h3,h4,h5,h6').map(h => ({ level: Number(h.tagName.slice(1)), text: h.textContent.trim() })),
      links: all('a').map(a => ({ text: a.textContent.trim(), href: a.href })),
      buttons: all('button').map(b => b.textContent.trim()),
      demoBanner: document.body.innerText.includes('Demo — sample data, nothing is saved'),
      demoAction: all('a,button').some(x => /try it with sample data/i.test(x.textContent || '')),
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      smallTargets: targetSizes.filter(x => x.width < 44 || x.height < 44),
    };
  });
  await context.close();
  return {
    path,
    documentStatus: response?.status(),
    ...data,
    requestOrigins: [...new Set(requests.map(r => new URL(r.url).origin))],
    failedResponses: responses.filter(r => r.status >= 400),
    consoleErrors,
    pageErrors,
    seriousCriticalAxe: axe.violations.filter(v => ['serious', 'critical'].includes(v.impact || '')).map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })),
  };
}

results.rootDesktop = await auditPage('/');
results.demo = await auditPage('/demo');
results.privacy = await auditPage('/privacy');
results.terms = await auditPage('/terms');
results.missing = await auditPage('/definitely-not-a-real-route');
results.rootMobile = await auditPage('/', { viewport: { width: 390, height: 844 } });
results.rootDark = await auditPage('/', { colorScheme: 'dark' });
results.rootReduced = await auditPage('/', { reducedMotion: 'reduce' });

const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
const requests = [];
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', error => pageErrors.push(error.message));
page.on('request', request => requests.push(request.url()));
await page.goto(base + '/', { waitUntil: 'networkidle' });
await page.keyboard.press('Tab');
const firstTab = await page.evaluate(() => ({ text: document.activeElement?.textContent?.trim(), visible: !!document.activeElement && getComputedStyle(document.activeElement).top !== '-100px' }));
await page.keyboard.press('Enter');
const afterSkip = await page.evaluate(() => ({ active: document.activeElement?.tagName, id: document.activeElement?.id, hash: location.hash }));
await page.locator('.add').first().focus();
await page.keyboard.press('Enter');
const countAfterKeyboardAdd = await page.locator('#count').textContent();
await page.getByRole('button', { name: /send request/i }).focus();
await page.keyboard.press('Enter');
const emptyError = await page.locator('#form-message').textContent();
const errorLive = await page.locator('#form-message').getAttribute('aria-live');
await page.getByRole('link', { name: 'Terms' }).first().click();
await page.waitForLoadState('networkidle');
const focusAfterNavigation = await page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.trim()?.slice(0, 80) }));
results.keyboardAndPrivacy = {
  firstTab,
  afterSkip,
  countAfterKeyboardAdd,
  emptyError,
  errorLive,
  focusAfterNavigation,
  requestOrigins: [...new Set(requests.map(url => new URL(url).origin))],
  consoleErrors,
  pageErrors,
};
await context.close();

const reducedContext = await browser.newContext({ reducedMotion: 'reduce' });
const reducedPage = await reducedContext.newPage();
await reducedPage.goto(base + '/', { waitUntil: 'networkidle' });
results.reducedMotion = await reducedPage.evaluate(() => {
  const values = Array.from(document.querySelectorAll('*')).flatMap(element => {
    const style = getComputedStyle(element);
    return [{ tag: element.tagName, animation: style.animationDuration, transition: style.transitionDuration }];
  });
  return values.filter(v => !['0s', '0.00001s'].includes(v.animation) || !['0s', '0.00001s'].includes(v.transition)).slice(0, 20);
});
await reducedContext.close();

await browser.close();
console.log(JSON.stringify(results, null, 2));
