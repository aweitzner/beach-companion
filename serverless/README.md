# Serverless Adapters

Beach Companion is hosted as a static GitHub Pages app, so sources that block
browser CORS need a small external adapter.

## Maine Healthy Beaches

`maine-water-quality-worker.js` is a Cloudflare Worker-style adapter for Maine
Healthy Beaches data.

It fetches:

- `https://apps.web.maine.gov/online/healthy_beaches/mapdata_bma.geojson`
- `https://apps.web.maine.gov/online/healthy_beaches/mapdata_site.geojson`

Then it returns the normalized Beach Companion water-quality shape for:

- `?beach=bar_harbor`
- `?beach=kennebunkport`

The frontend defaults to:

```text
/api/water-quality/maine
```

For testing or deployment before a same-origin route exists, pass:

```text
?mhbProxyUrl=https://your-worker.example.workers.dev
```

Long term, route `/api/water-quality/maine` to the deployed worker so the public
app does not need a query-string override.

## Deploy

This repo includes `wrangler.toml` for Cloudflare Workers.

Install dependencies and deploy:

```bash
npm install
npm run deploy:maine-water-quality
```

If the app remains on `aweitzner.github.io`, GitHub Pages cannot serve
`/api/water-quality/maine` itself. After deployment, either:

- update `MAINE_WATER_QUALITY_PROXY_URL` in `app.js` to the deployed Worker URL,
- pass `?mhbProxyUrl=<worker-url>` while testing, or
- put the app behind a custom domain where `/api/water-quality/maine` routes to
  the Worker.
