## Target classification

**Site:** Books to Scrape (https://books.toscrape.com)

**Why this target:** Books to Scrape is a sandbox site explicitly built for scraping practice. Its own description states it "desperately wants to be scraped" and exists as a safe place for beginners learning web scraping and developers testing their scraping tools.

**Scope:** Only the first 3 catalogue pages (60 books total) — no more.

**Data collected:** Book title, price, availability, rating, and description — all publicly displayed product information, nothing behind a login or paywall.

**robots.txt result:** Requesting `https://books.toscrape.com/robots.txt` returns a `404 Not Found` — no robots.txt file exists on this site. This is not the same as explicit permission; it simply means the site has stated no automated-access rules either way. Given the site's own stated purpose (a scraping practice sandbox), proceeding is appropriate here.

I will not reuse this code on another site without checking its rules and terms first.