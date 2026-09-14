const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { z } = require('zod');

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
  const bookMap = new Map(); // bookUrl -> sourcePage
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
      if (!bookMap.has(absoluteUrl)) {
        bookMap.set(absoluteUrl, currentUrl);
      }
    });

    const nextHref = $('li.next a').attr('href');
    if (nextHref && pageNumber < 3) {
      currentUrl = new URL(nextHref, currentUrl).toString();
      pageNumber++;
    } else {
      currentUrl = null;
    }
  }

  return { bookMap, pagesFetched };
}

function cacheFileForBook(bookUrl) {
  const parts = bookUrl.split('/').filter(Boolean);
  const slug = parts[parts.length - 2]; // the segment just before "index.html"
  return path.join(__dirname, '..', 'cache', 'books', `${slug}.html`);
}

async function extractBookRecord(bookUrl, sourcePage) {
  const html = await fetchCached(bookUrl, cacheFileForBook(bookUrl));
  const $ = cheerio.load(html);

  const title = $('.product_main h1').text().trim();
  const priceText = $('.product_main .price_color').first().text().trim();
  const availabilityText = $('.product_main .availability').text().trim().replace(/\s+/g, ' ');

  const ratingClasses = $('.product_main .star-rating').attr('class') || '';
  const ratingMatch = ratingClasses.split(' ').find(c => c !== 'star-rating');
  const ratingText = ratingMatch || null;

  const descriptionEl = $('#product_description').next('p');
  const description = descriptionEl.length ? descriptionEl.text().trim() : null;

  return {
    title,
    product_url: bookUrl,
    price_text: priceText,
    availability_text: availabilityText,
    rating_text: ratingText,
    description,
    source_page: sourcePage,
    fetched_at: new Date().toISOString(),
  };
}
const BookSchema = z.object({
  title: z.string().min(1),
  product_url: z.string().url(),
  price_gbp: z.number().positive(),
  price_text: z.string(),
  availability_text: z.string(),
  rating_text: z.string().nullable(),
  description: z.string().nullable(),
  source_page: z.string().url(),
  fetched_at: z.string(),
});

function normalizeRecord(raw) {
  const priceMatch = raw.price_text.match(/[\d.]+/);
  const price_gbp = priceMatch ? parseFloat(priceMatch[0]) : NaN;

  return {
    title: raw.title,
    product_url: raw.product_url,
    price_gbp,
    price_text: raw.price_text,
    availability_text: raw.availability_text,
    rating_text: raw.rating_text,
    description: raw.description,
    source_page: raw.source_page,
    fetched_at: raw.fetched_at,
  };
}

function validateRecords(rawRecords) {
  const validRecords = [];
  const errors = [];
  const seenUrls = new Set();

  for (const raw of rawRecords) {
    const normalized = normalizeRecord(raw);

    if (seenUrls.has(normalized.product_url)) {
      continue; // skip duplicate, already counted once
    }

    const result = BookSchema.safeParse(normalized);

    if (result.success) {
      validRecords.push(result.data);
      seenUrls.add(normalized.product_url);
    } else {
      errors.push({
        product_url: raw.product_url,
        reason: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }
  }

  return { validRecords, errors };
}
async function main() {
  const { bookMap, pagesFetched } = await discoverCataloguePages();
  const bookUrls = Array.from(bookMap.keys());

  console.log(`catalogue_pages=${pagesFetched}`);
  console.log(`discovered=${bookUrls.length}`);
  console.log(`unique_urls=${bookUrls.length}`);

  const rawRecords = [];
  for (const bookUrl of bookUrls) {
    const sourcePage = bookMap.get(bookUrl);
    const record = await extractBookRecord(bookUrl, sourcePage);
    rawRecords.push(record);
  }

  console.log(`detail_pages=${rawRecords.length}`);

  const { validRecords, errors } = validateRecords(rawRecords);

  const outputDir = path.join(__dirname, '..', 'output');
  fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(
    path.join(outputDir, 'books.json'),
    JSON.stringify(validRecords, null, 2)
  );

  fs.writeFileSync(
    path.join(outputDir, 'errors.json'),
    JSON.stringify(errors, null, 2)
  );

  console.log(`valid_records=${validRecords.length}`);
  console.log(`invalid_records=${errors.length}`);
}
main().catch((err) => {
  console.error('Run failed:', err.message);
  process.exit(1);
});