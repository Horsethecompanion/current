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
- Long-press anywhere to open **Settings** — pick a location from a
  built-in list, use your device's location to jump to the nearest one,
  enter any GXP code directly, and set a retail margin (c/kWh) added on
  top of the wholesale price. Both persist locally in the browser.
- Two-finger tap cycles night mode (auto → on → off → auto).
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

- `gxpNode` — default GXP, used until someone picks a different one in
  Settings (which persists in `localStorage`, so it survives reloads).
- `retailMargin` — default flat c/kWh added on top of wholesale, also
  overridable per-device from Settings.
- `historyHours` / `forecastHours` — how far back/forward the timeline
  shows by default.
- `colourStops` / `priceScale` — the colour ramp. Prices are mapped
  through a piecewise linear→log scale before colouring, so normal daily
  movement (5–25 c/kWh) stays visually informative while rare price
  spikes (hundreds to low thousands of c/kWh, which do happen during NZ
  market scarcity events) still read as distinct rather than all
  clamping to the same dark red.
- `dataRefreshSeconds` — how often the app polls the Worker.

### Node list

`js/nodes.js` has a curated list of GXPs for major NZ population centres,
matched against WITS's own official node reference list — so the
code-to-place mapping is authoritative, not a guess. Only Albany has
actually been fetch-tested end-to-end against live price data; the rest
are almost certainly fine (they're all major, actively-traded GXPs), but
if one comes back empty, it fails safely — amber status dot, last good
data retained, never a silently-wrong number. The in-app "Custom GXP
code" field works for anywhere not on the list, no code change needed.

## Known limitations / ideas for later

- No in-app way to *find* your GXP code if you're not near one of the
  listed cities, beyond the Electricity Authority's own dataset link
  shown in Settings.
- Long-press "show the actual line graph over the heatmap" overlay was
  discussed but not built.
- If this app is used as-is (not forked with your own Worker), price
  requests go through the original deployer's Cloudflare account and
  WITS subscription — fine at hobby scale, but worth knowing.

## License

Personal project, shared as-is. No warranty — check the current price
against your retailer's own tools before making any decision that costs
real money.
