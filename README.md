# The Polite Scraper

A small, respectful scraping pipeline that downloads the first 3 catalogue pages of Books to Scrape, visits all 60 book pages, and turns the raw HTML into clean, schema-validated JSON. Built for the FlyRank Backend AI Engineering internship, Assignment A9.

## Target classification

**Site:** Books to Scrape (https://books.toscrape.com)

**Why this target:** Books to Scrape is a sandbox site explicitly built for scraping practice. Its own description states it "desperately wants to be scraped" and exists as a safe place for beginners learning web scraping and developers testing their scraping tools.

**Scope:** Only the first 3 catalogue pages (60 books total) — no more.

**Data collected:** Book title, price, availability, rating, and description — all publicly displayed product information, nothing behind a login or paywall.

**robots.txt result:** Requesting `https://books.toscrape.com/robots.txt` returns a `404 Not Found` — no robots.txt file exists on this site. This is not the same as explicit permission; it simply means the site has stated no automated-access rules either way. Given the site's own stated purpose (a scraping practice sandbox), proceeding is appropriate here.

I will not reuse this code on another site without checking its rules and terms first.

## Install & Run

```bash
npm install
node src/index.js
```

Requires Node.js 18+ (for built-in `fetch`). This one command runs the whole pipeline: fetch → extract → normalize → validate → store → report.

Output lands in `output/books.json`, `output/errors.json`, and `output/run-report.json`. HTML pages are cached in `cache/` between runs (git-ignored).

## Record schema

Each valid record in `books.json`:

| Field | Type | Notes |
|---|---|---|
| `title` | string | Book title |
| `product_url` | string (URL) | Canonical identity of the record |
| `price_gbp` | number | Parsed from `price_text`, e.g. `51.77` |
| `price_text` | string | Original price as shown, e.g. `"£51.77"` |
| `availability_text` | string | e.g. `"In stock (22 available)"` |
| `rating_text` | string \| null | e.g. `"Three"` |
| `description` | string \| null | `null` when the book has no description on the page |
| `source_page` | string (URL) | Which catalogue page this book was discovered on |
| `fetched_at` | string (ISO timestamp) | When this record was fetched |

Validated with [Zod](https://zod.dev/) — a record failing validation is set aside in `errors.json` with a reason, never silently stored.

## Politeness rules

- **User-agent:** every request identifies itself as `FlyRankInternshipA9/1.0 (+https://github.com/037teddy/Scraper)`
- **Timeout:** every request gives up after 8 seconds rather than hanging forever
- **Delay:** at least 600ms between real requests to the site — cached pages need no delay, since they never leave the machine
- **Caching:** every fetched page is saved to `cache/`; repeat runs during development read from disk instead of re-requesting
- **Status check:** only a `200` response is treated as a real page; anything else is a failed fetch, not content to parse
- **Retry rules:** a timeout or `5xx` response is retried once after a short wait; a `404` or `403` is never retried — the page genuinely doesn't exist, or the site has said no

## Resilience

Each book page is processed independently. If one page fails (timeout, 404, etc.), it's logged and skipped — the run continues and the other good records are still saved. Proven by deliberately adding a fake book URL during testing: the run finished, `books.json` still held all 60 good records, and `run-report.json` recorded `failed_pages: 1`.

## Sample run report

```json
{
  "started_at": "2026-09-15T08:49:42.494Z",
  "finished_at": "2026-09-15T08:49:44.466Z",
  "duration_ms": 1972,
  "pages_fetched": 0,
  "cache_hits": 63,
  "valid_records": 60,
  "invalid_records": 0,
  "failed_pages": 0,
  "failed_page_details": []
}
```

## Why no browser was needed

All the data this scraper needs — titles, prices, availability, ratings, descriptions — is present directly in the HTML the server sends on first response. Viewing the page source (not just the rendered page) confirms this. A headless browser like Playwright would add real cost (memory, startup time, complexity) for zero benefit here, since there's no JavaScript-rendered content to wait for.

## Ethics note

This scraper only targets a site explicitly built and offered for scraping practice. In general: prefer an official API when one exists, never bypass logins, paywalls, or explicit blocks (like a restrictive `robots.txt` or a `403` response), and collect only the data actually needed for the task — not everything a page happens to expose.

## Limitations

- No retry backoff strategy beyond a single retry — a page that fails twice in a row is given up on for that run (the assignment notes this is intentionally simple; proper exponential backoff is next week's assignment, A16).
- Ratings and availability are stored as their original text (`"Three"`, `"In stock (22 available)"`) rather than further parsed into numbers — kept as-is since the assignment's schema treats them as text fields.