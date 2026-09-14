const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const USER_AGENT = 'FlyRankInternshipA9/1.0 (+https://github.com/037teddy/Scraper)';
const TIMEOUT_MS = 8000;
const DELAY_MS = 600;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithPoliteness(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function fetchCached(url, cachePath) {
  if (fs.existsSync(cachePath)) {
    const html = fs.readFileSync(cachePath, 'utf-8');
    console.log(`CACHE HIT: ${url} (${html.length} bytes)`);
    return html;
  }

  const response = await fetchWithPoliteness(url);

  if (response.status !== 200) {
    throw new Error(`Fetch failed: ${url} returned status ${response.status}`);
  }

  const html = await response.text();
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, html, 'utf-8');
  console.log(`FETCH: ${url} (${html.length} bytes)`);

  await delay(DELAY_MS);

  return html;
}

function cacheFileFor(pageNumber) {
  return path.join(__dirname, '..', 'cache', `catalogue-page-${pageNumber}.html`);
}

async function discoverCataloguePages() {
  const bookUrls = new Set();
  let pageNumber = 1;
  let currentUrl = 'https://books.toscrape.com/catalogue/page-1.html';
  let pagesFetched = 0;

  while (currentUrl && pageNumber <= 3) {
    const html = await fetchCached(currentUrl, cacheFileFor(pageNumber));
    pagesFetched++;

    const $ = cheerio.load(html);

    $('article.product_pod h3 a').each((i, el) => {
      const href = $(el).attr('href');
      const absoluteUrl = new URL(href, currentUrl).toString();
      bookUrls.add(absoluteUrl);
    });

    const nextHref = $('li.next a').attr('href');
    if (nextHref && pageNumber < 3) {
      currentUrl = new URL(nextHref, currentUrl).toString();
      pageNumber++;
    } else {
      currentUrl = null;
    }
  }

  return { bookUrls: Array.from(bookUrls), pagesFetched };
}

async function main() {
  const { bookUrls, pagesFetched } = await discoverCataloguePages();

  console.log(`catalogue_pages=${pagesFetched}`);
  console.log(`discovered=${bookUrls.length}`);
  console.log(`unique_urls=${bookUrls.length}`);
}

main().catch((err) => {
  console.error('Run failed:', err.message);
  process.exit(1);
});