# Beach Companion Europe

This folder is the standalone source of truth for the Europe version of Beach Companion.

Current live scope:
- Sao Miguel, Azores
- Open-Meteo weather forecast
- Open-Meteo marine forecast
- Regional weather + sea conditions

Current features:
- 7-day selector
- Daytime weather summary
- Feels-like summary
- Sea State card
- Tide Outlook card
- Wind chart
- Temperature chart
- Precipitation chart
- Sun and Moon card
- Metric / Imperial toggle

## Project Structure

This directory is self-contained and ready to be used as its own repo root.

Included files:
- `index.html`
- `app.js`
- `style.css`
- `manifest.json`
- `astronomy.browser.min.js`
- `icon-180.png`
- `icon-192.png`
- `icon-512.png`

## Data Sources

- Weather forecast: Open-Meteo Forecast API
- Marine forecast: Open-Meteo Marine API
- Sun and moon times: local astronomy calculation via `astronomy.browser.min.js`

Notes:
- The Tide Outlook card is based on Open-Meteo modeled sea-level height.
- It is useful for planning, but it is not a tide-station or navigation-grade source.

## Local Development

From this `azores` folder:

```bash
cd /Users/andyweitzner/Documents/Program_Files/beach-app/azores
python3 -m http.server 8000
```

Open:

```text
http://localhost:8000/
```

## GitHub Pages

This folder is intended to be the root of the separate Europe repo:

```text
Beach_Companion_Europe
```

GitHub Pages settings:
- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`

Expected site URL:

```text
https://aweitzner.github.io/Beach_Companion_Europe/
```

## Product Framing

Beach Companion US:
- NOAA / NWS beach companion
- Tides and U.S.-specific coastal signals

Beach Companion Europe:
- Regional weather + sea conditions
- Simpler location model
- Separate deployment and roadmap
