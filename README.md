# rakshithsajjan.com

Personal site + blog built with Astro, served from Cloudflare Workers. Posts are Markdown-first; the background video loops in the hero and search/RSS are baked in via precomputed JSON and the Astro RSS integration.

## Features

- **Markdown modules** (imported via `import.meta.glob`) drive the blog metadata and rendering (`src/content/blog`).
- **Hero video loop** (muted + autoplay) sits behind the intro copy; swap `src/pages/index.astro` with your own MP4/WebM in `public/` or point to a CDN asset.
- **Search** consumes `public/search-index.json` to power client-side filtering; run `npm run generate-search-index` when you add or edit posts.
- **RSS** endpoint at `/rss.xml` powered by `@astrojs/rss` (feeds every Markdown entry).
- **Cloudflare Worker site** (`workers-site/index.js`) serves the Astro `dist/` build, enforces `www → non-www` redirects, and ships via Wrangler with static asset bindings.

## Scripts

```sh
npm install
npm run dev                    # Astro dev server with hot reload
npm run build                  # regenerate the search index and build for production
npm run preview                # preview the built site locally
npm run generate-search-index  # refresh public/search-index.json
```

## Content workflow

1. Add `.md` files under `src/content/blog/` with frontmatter: `title`, `description`, `pubDate`, optional `tags`, optional `cover`.
2. Run `npm run generate-search-index` to refresh the client search payload.
3. Run `npm run build` to emit `dist/` and prepare assets for Cloudflare.

## Cloudflare deployment

1. Install Wrangler (`npm install -g wrangler`) and log in: `wrangler login`.
2. Update `wrangler.toml`: fill `route` (e.g., `rakshithsajjan.com/*`) and `zone_id` (your Cloudflare zone). `account_id` and `workers_dev` are already set.
3. Deploy static assets plus the redirect worker:
   ```sh
   npm run build
   wrangler publish
   ```
4. Use the Cloudflare dashboard if needed to verify the Worker is attached to `rakshithsajjan.com` and to manage SSL or edge rules.

## Suggestions & next steps

- Replace the placeholder video `src/pages/index.astro` references with your final clip (drop the file in `public/` or use a CDN link).
- Wire up tag filtering, RSS categories, or newsletter signup as needed—everything compiles to static files, so the Worker stays simple.
- Once the zone is active, point `rakshithsajjan.com` to the Worker route and keep the search JSON fresh via the provided script.
