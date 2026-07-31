# Current

A minimalist, always-on display of the current New Zealand wholesale
electricity price, with a colour-coded timeline showing where it's been
and where it's forecast to go. Built to run on a spare phone or tablet
mounted somewhere you'll glance at it — the goal is answering "is power
cheap or expensive right now?" in under a second, not building a
dashboard.

**Live**: https://horsethecompanion.github.io/current/

This deploy is already wired up and running on real data — Albany
(North Shore, Auckland) by default, with a Cloudflare Worker fetching
live NZ wholesale prices. Anyone else running it can change the location
from within the app itself; no code editing required (see Settings,
below).

## What it looks like

- A single large number: the current wholesale price, in c/kWh (plus
  your retail margin, if you've set one).
- A full-screen background timeline, coloured from cheap (green) through
  to expensive (red/crimson), with "now" in the centre — history to the
  left, forecast to the right.
- Tap anywhere to zoom the timeline between ±4h and ±24h, with a smooth
  animated transition.
- Long-press anywhere to open **Settings**:
  - Pick a location from a built-in list of major NZ centres, hit "Use
    my location" to jump to the nearest one, or type any GXP code
    directly if yours isn't listed.
  - Set a retail margin, as either a flat c/kWh add-on or a percentage
    on top of wholesale. Leave at 0 to show wholesale only.
  - Both choices persist locally in the browser (`localStorage`), so
    they survive reloads.
- Two-finger tap cycles night mode (auto → on → off → auto), each change
  confirmed with a brief on-screen label so it's obvious which state you
  landed on. Night mode meaningfully dims the whole display, not just
  the text — comfortable to glance at in a dark room.
- A small status dot: green means the last live price fetch succeeded;
  amber means it failed and you're looking at the last data that did
  work (the display never just goes blank).
- Installable as a PWA (add to home screen) for a proper chrome-free,
  fullscreen kiosk display. In a regular browser tab, the first tap
  requests fullscreen too.

## How it's built

Plain HTML/CSS/JS, no build step, no frameworks:

```
index.html
css/style.css
js/
  config.js     — all the tunable settings and live defaults
  nodes.js      — known GXP locations + Settings persistence (node, margin)
  mockdata.js   — synthetic data generator (realistic daily price shape)
  livedata.js   — polls the live data source, matches mockdata's interface
  renderer.js   — canvas rendering: colour scale, gradients, timeline, ticks
  app.js        — glues it together, handles animation/interaction/gestures
manifest.json, sw.js  — PWA shell (installable, caches app files for
                        offline resilience — never caches price data)
cloudflare-worker/    — see below
```

The renderer doesn't know or care where its data comes from — `mockdata.js`
and `livedata.js` expose the same interface (`getData()`,
`getCurrentIndex()`, `getCurrentPrice()`, `refresh()`), so switching
between them is a one-line config change. Retail margin is applied as a
separate display-layer transform on top of whichever data source is
active, so it works identically for both.

### Where the price data comes from

NZ wholesale electricity prices are published per grid connection point
(GXP) by [WITS](https://developer.electricityinfo.co.nz/WITS/login)
(electricityinfo.co.nz).

Browsers can't safely call the WITS API directly — it needs an OAuth
client secret, which can't be exposed in client-side JS. So there's a
small Cloudflare Worker (`cloudflare-worker/`) that sits in between: it
holds the credentials, fetches both the actual settled prices (`RTD`
schedule) and the forward price schedule (`PRSL`), merges them into one
time series, and caches the result at Cloudflare's edge for ~60 seconds.
The app just polls that Worker — no keys, no CORS problems.

Full setup steps (getting WITS API access, deploying the Worker) are in
[`cloudflare-worker/README.md`](cloudflare-worker/README.md).

## Running your own copy

This repo is already configured to point at a live Worker and node —
clone it and it'll just work, showing real prices for Albany by default.

To point it at your own Worker instead (recommended if you're forking
this rather than just using it — see the note on shared infrastructure
below):

1. Follow [`cloudflare-worker/README.md`](cloudflare-worker/README.md)
   to get your own WITS API access and deploy your own Worker.
2. In `js/config.js`, set `workerUrl` to your deployed Worker's URL.
3. In `cloudflare-worker/wrangler.toml`, set `ALLOWED_ORIGIN` to wherever
   you're hosting your copy.
4. Deploy `index.html` and friends anywhere static (GitHub Pages, any
   static host). No server-side code needed beyond the Worker itself.

Want to work on it locally without touching live data? Set
`useMockData: true` in `js/config.js` — shows a synthetic but realistic
price pattern with no API setup at all.

## Configuration

Everything tunable lives in `js/config.js`:

- `gxpNode` — default GXP, used until someone picks a different one in
  Settings.
- `retailMargin` — default margin value (flat c/kWh or percentage,
  see `js/nodes.js`), also overridable per-device from Settings.
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

## Worth knowing

If someone uses this deploy as-is (rather than forking it with their own
Worker), their price requests go through the original deployer's
Cloudflare account and WITS subscription. Fine at hobby scale — free
Cloudflare Workers tier is 100,000 requests/day — but worth being aware
of if this gets shared around.

## License

Personal project, shared as-is. No warranty — check the current price
against your retailer's own tools before making any decision that costs
real money.
