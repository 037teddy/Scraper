const fs = require('fs');
const path = require('path');

const USER_AGENT = 'FlyRankInternshipA9/1.0 (+https://github.com/037teddy/Scraper)';
const TIMEOUT_MS = 8000;

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
  return html;
}

async function main() {
  const url = 'https://books.toscrape.com/catalogue/page-1.html';
  const cachePath = path.join(__dirname, '..', 'cache', 'catalogue-page-1.html');

  await fetchCached(url, cachePath);
}

main().catch((err) => {
  console.error('Run failed:', err.message);
  process.exit(1);
});