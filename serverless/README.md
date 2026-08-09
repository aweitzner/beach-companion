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

## NDBC Waves

`ndbc-wave-worker.js` is a Cloudflare Worker-style adapter for NDBC buoy wave
observations.

It fetches:

- `https://www.ndbc.noaa.gov/data/realtime2/<station>.txt`

Then it returns normalized wave fields for:

- `?station=44007`
- `?station=44009`
- `?station=44033`
- `?station=44065`
- `?station=44091`

The frontend defaults to:

```text
/api/waves/ndbc
```

For testing or deployment before a same-origin route exists, pass:

```text
?wavesProxyUrl=https://your-waves-worker.example.workers.dev
```

Long term, route `/api/waves/ndbc` to the deployed worker or update
`NDBC_WAVES_PROXY_URL` in `app.js` to the deployed Worker URL.

## Deploy

This repo includes `wrangler.toml` and `wrangler.ndbc-waves.toml` for
Cloudflare Workers.

Install dependencies and deploy:

```bash
npm install
npm run deploy:maine-water-quality
npm run deploy:ndbc-waves
```

If the app remains on `aweitzner.github.io`, GitHub Pages cannot serve
`/api/water-quality/maine` itself. After deployment, either:

- update `MAINE_WATER_QUALITY_PROXY_URL` in `app.js` to the deployed Worker URL,
- pass `?mhbProxyUrl=<worker-url>` while testing, or
- put the app behind a custom domain where `/api/water-quality/maine` routes to
  the Worker.
