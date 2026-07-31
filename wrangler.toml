# Current — price proxy worker

Thin Cloudflare Worker that sits between the "Current" app and WITS's
Market Prices API (electricityinfo.co.nz). It holds your API credentials,
queries current + forecast wholesale prices for a GXP node via GraphQL,
and caches the result for ~60s.

## 1. Get API access

1. Sign up and log in at https://developer.electricityinfo.co.nz/WITS/login
2. Under **My Apps**, create an application (any redirect URI works —
   it's required by the form but unused by the client-credentials flow
   this worker uses).
3. Under that app's **Services**, click **Activate** on
   `Pricing_API_Application_Registration`.
4. Under **Authentication**, generate a Client ID / Client Secret if one
   isn't already there.

Your node for North Shore / Albany is **ALB0331** — already the default.

Schedule names are confirmed and already set in `worker.js`: `RTD`
(actual settled dispatch prices, for history) and `PRSL` (forward price
schedule, for the forecast side). Token URL and the REST `/prices`
endpoint are both confirmed from real, authenticated responses in the
portal's "Try it out" console.

## 2. Install Wrangler (Cloudflare's CLI)

```bash
npm install -g wrangler
wrangler login
```

## 3. Set your secrets

```bash
cd cloudflare-worker
wrangler secret put WITS_CLIENT_ID
wrangler secret put WITS_CLIENT_SECRET
```

## 4. Lock down CORS

Edit `wrangler.toml` and set `ALLOWED_ORIGIN` to your actual GitHub Pages
URL, e.g.:

```toml
ALLOWED_ORIGIN = "https://horsethecompanion.github.io"
```

(Leave it as `"*"` while you're testing locally, then lock it down before
you consider this "done".)

## 5. Deploy

```bash
wrangler deploy
```

This prints a URL like `https://current-prices.<your-subdomain>.workers.dev`.

## 6. Point the app at it

In `js/config.js`:

```js
useMockData: false,
workerUrl: "https://current-prices.<your-subdomain>.workers.dev",
```

## 7. Test it directly

```bash
curl "https://current-prices.<your-subdomain>.workers.dev/prices?node=ALB0331"
```

You should get back:

```json
{
  "node": "ALB0331",
  "generatedAt": "...",
  "prices": [
    { "time": "2026-07-20T05:00:00.000Z", "price": 8.4 },
    ...
  ]
}
```

If you get a 502, the `detail` field in the response body will usually
point at the problem — most likely `FORECAST_SCHEDULE` still needing the
real identifier from step 2 above.

## Notes

- The worker caches responses at Cloudflare's edge for 60 seconds via
  `Cache-Control`, so polling every minute from the app costs you at most
  one upstream call per minute, however many devices are watching.
- The OAuth token is cached in memory for the life of the Worker
  instance, so most requests skip the token round-trip entirely.
- `tradingDateTime` is handled whether it arrives with an explicit
  timezone offset or as a naive NZ wall-clock string — the worker asks
  the JS runtime's own Pacific/Auckland rules for the correct offset at
  that exact date, rather than hardcoding +12/+13, so it stays correct
  across the daylight-saving boundary.
- Free Cloudflare Workers tier is 100,000 requests/day — miles more than
  this will ever use.
