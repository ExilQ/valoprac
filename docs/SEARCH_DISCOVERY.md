# Search discovery for VALOPRAC

Production origin: https://valoprac.trade/

The homepage and public guides contain readable HTML, descriptive Korean titles with relevant English product terms, canonical URLs, social metadata, crawlable links, and WebSite/WebApplication/WebPage structured data. The application UI remains Korean. The dedicated `/valorant-aim-trainer.html` page explains the existing features, a ten-minute routine, supported input devices, local storage, and simulation limits. It does not claim verified improvement, native game equivalence, ratings, or official Riot endorsement.

Only `https://valoprac.trade/` is eligible for search results. The sitemap contains this one URL. All other HTML pages have `noindex,follow`; the response Worker also enforces exclusion on subpage aliases, the legacy `/index.html` address, verification documents, and downloadable data. Guides and training screens remain accessible. Search crawlers must remain allowed to fetch those pages and observe the exclusion.

`scripts/search-metadata.mjs` separates the single indexable homepage from the complete set of content pages. `scripts/export-routes.mjs` preserves the application entry points and excludes every other HTML document, including future additions. Duplicate application entry points retain the homepage canonical. Build and response checks enforce the homepage-only policy for GET, HEAD, and conditional responses.

## Notify search engines after publication

After the corresponding deployment succeeds, run:

```sh
node scripts/notify-indexnow.mjs --submit
```

The script checks the live verification file and the indexing policy on every changed content page before making an IndexNow request to the shared endpoint and Naver's documented endpoint. It notifies search engines of excluded pages as updates so earlier submissions can be removed; notifying a changed URL is not a request to keep it indexed. Only the homepage is listed in the sitemap. A 200 or 202 response confirms receipt, not indexing or ranking. Do not resend solely because no search result appears immediately.

`deployment/search-discovery.json` points to the domain verification file in `public/`. Its token is intentionally published for IndexNow ownership checks. It is not an API credential for a paid service, a private account, or the application backend. Do not replace it on every build.

## Google Search Console

Google account authorization and verified ownership are required to register the property and submit the sitemap through Search Console. Use the exact property URL returned by Search Console, and submit `https://valoprac.trade/sitemap.xml`. If verification is needed, obtain the verification token from the account before adding the corresponding HTML file or tag. Do not fabricate verification tokens or use the restricted Google Indexing API for ordinary training pages.

Search placement and processing times are controlled by the search engines. Metadata, sitemaps, structured data, and URL notifications help discovery but do not purchase or guarantee a position for any query.

For quicker exclusion of the previously promoted guides, use targeted temporary removal requests in Search Console in addition to permanent `noindex` rules. Never remove the whole `https://valoprac.trade/` prefix. Do not submit removal requests for homepage canonical aliases such as `/index.html` or cloned application entry points; Google warns that removing alternate versions may affect the preferred URL.

## Crawler preferences

Keep GPTBot disallowed and OAI-SearchBot allowed. Googlebot, Bingbot, and other unspecified crawlers remain allowed through the wildcard group. This setting separates OpenAI model-training collection from search discovery.
