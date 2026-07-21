# Current

A minimalist, always-on display of the current New Zealand wholesale
electricity price, with a colour-coded timeline showing where it's been
and where it's forecast to go. Built to run on a spare phone or tablet
mounted somewhere you'll glance at it — the goal is answering "is power
cheap or expensive right now?" in under a second, not building a
dashboard.

**Live**: https://horsethecompanion.github.io/current/

## What it looks like

- A single large number: the current wholesale price, in c/kWh.
- A full-screen background timeline, coloured from cheap (green) through
  to expensive (red/crimson), with "now" in the centre — history to the
  left, forecast to the right.
- Tap anywhere to zoom the timeline between ±4h and ±24h, with a smooth
  animated transition.
- A small status dot: green means the last live price fetch succeeded;
  amber means it failed and you're looking at the last data that did
  work (the display never just goes blank).

## How it's built

Plain HTML/CSS/JS, no build step, no frameworks:

```
index.html
css/style.css
js/
  config.js     — all the tunable settings in one place
  mockdata.js   — synthetic data generator (realistic daily price shape)
  livedata.js   — polls the live data source, matches mockdata's interface
  renderer.js   — canvas rendering: colour scale, gradients, timeline, ticks
  app.js        — glues it together, handles animation/interaction
manifest.json, sw.js  — PWA shell (installable, caches app files for
                        offline resilience — never caches price data)
cloudflare-worker/    — see below
```

The renderer doesn't know or care where its data comes from — `mockdata.js`
and `livedata.js` expose the same interface (`getData()`,
`getCurrentIndex()`, `getCurrentPrice()`, `refresh()`), so switching
between them is a one-line config change.

### Where the price data comes from

NZ wholesale electricity prices are published per grid connection point
(GXP) by [WITS](https://developer.electricityinfo.co.nz/WITS/login)
(electricityinfo.co.nz). This app defaults to node `ALB0331` (Albany,
Auckland's North Shore) but any valid GXP code will work.

Browsers can't safely call the WITS API directly — it needs an OAuth
client secret, which can't be exposed in client-side JS. So there's a
small Cloudflare Worker (`cloudflare-worker/`) that sits in between: it
holds the credentials, fetches both the actual settled prices (`RTD`
schedule) and the forward price schedule (`PRSL`), merges them into one
time series, and caches the result at Cloudflare's edge for ~60 seconds.
The app just polls that Worker — no keys, no CORS problems.

Full setup steps (getting WITS API access, deploying the Worker) are in
[`cloudflare-worker/README.md`](cloudflare-worker/README.md).

## Running it yourself

By default, `js/config.js` has `useMockData: true` — clone the repo,
serve it locally (`python3 -m http.server`, or just open `index.html`)
and it'll show a synthetic but realistic price pattern with no setup at
all.

To connect real data:

1. Follow [`cloudflare-worker/README.md`](cloudflare-worker/README.md)
   to get WITS API access and deploy the Worker.
2. In `js/config.js`, set:
   ```js
   useMockData: false,
   workerUrl: "https://your-worker.your-subdomain.workers.dev",
   gxpNode: "ALB0331", // or your own GXP code
   ```
3. Deploy `index.html` and friends anywhere static (GitHub Pages, any
   static host). No server-side code needed beyond the Worker itself.

## Configuration

Everything tunable lives in `js/config.js`:

- `gxpNode` — which GXP to show prices for.
- `retailMargin` — flat c/kWh added on top of wholesale (defaults to 0;
  useful once you know your retailer's actual margin/fees structure).
- `historyHours` / `forecastHours` — how far back/forward the timeline
  shows by default.
- `colourStops` / `priceScale` — the colour ramp. Prices are mapped
  through a piecewise linear→log scale before colouring, so normal daily
  movement (5–25 c/kWh) stays visually informative while rare price
  spikes (hundreds to low thousands of c/kWh, which do happen during NZ
  market scarcity events) still read as distinct rather than all
  clamping to the same dark red.
- `dataRefreshSeconds` — how often the app polls the Worker.

## Known limitations / ideas for later

- Single hardcoded GXP node — a location picker (with browser geolocation
  to suggest the nearest node) would be a natural next step if this ever
  goes properly multi-user.
- No retail margin UI yet — the config field exists, but there's no
  in-app way to set it.
- Long-press "show the actual line graph over the heatmap" overlay was
  discussed but not built.

## License

Personal project, shared as-is. No warranty — check the current price
against your retailer's own tools before making any decision that costs
real money.
