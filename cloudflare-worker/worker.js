/**
 * Current — wholesale price proxy worker
 *
 * Sits between the "Current" web app and the WITS (electricityinfo.co.nz)
 * Market Prices API. Holds the OAuth client credentials (never exposed to
 * the browser), queries current + forecast prices for a GXP node via
 * GraphQL, and caches the result for ~60s so repeated polling doesn't
 * hammer the upstream API or the token endpoint.
 *
 * ============================================================
 * CONFIRMED — from a real, authenticated GET /schedules response
 * ============================================================
 * Every schedule has a FIXED runType — it's not a per-row draft/final
 * flag the way an earlier version of this file assumed. The relevant
 * ones for this app:
 *
 *   RTD  → runType "D"  — real dispatch, actual settled 5-min prices.
 *          This is "what actually happened" — used for history.
 *   PRSL → runType "G"  — forward price schedule (forecast), the
 *          longer-range one. Used for the forecast side of the timeline.
 *
 * (There's no "RTP" schedule at all in this account's real schedule
 * list — that name came from the docs' generic example query and
 * doesn't exist here. An earlier version of this worker was pointed at
 * it by mistake.)
 *
 * Also confirmed, from the official Kong Developer Portal User Guide:
 * - Token URL:  https://api.electricityinfo.co.nz/login/oauth2/token
 * - Grant type: client_credentials
 * - GraphQL endpoint: https://api.electricityinfo.co.nz/api/market-prices/v1/graphql
 * ============================================================
 */

const TOKEN_URL = "https://api.electricityinfo.co.nz/login/oauth2/token";
const GRAPHQL_URL = "https://api.electricityinfo.co.nz/api/market-prices/v1/graphql";

const MARKET_TYPE = "E"; // Energy (as opposed to Reserves)

const ACTUAL_SCHEDULE = "RTD";     // runType "D" — real settled dispatch prices
const FORECAST_SCHEDULE = "PRSL";  // runType "G" — forward price schedule

// In-memory token cache — persists for the lifetime of the Worker isolate,
// which is usually long enough to avoid re-authenticating on every request.
let cachedToken = null;
let cachedTokenExpiry = 0;

export default {

    async fetch(request, env, ctx) {

        const origin = request.headers.get("Origin") || "";
        const corsHeaders = buildCorsHeaders(origin, env);

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        const url = new URL(request.url);

        if (url.pathname !== "/prices") {
            return json({ error: "Not found" }, 404, corsHeaders);
        }

        const node = url.searchParams.get("node") || env.DEFAULT_NODE || "ALB0331";

        // Serve from Cloudflare's edge cache if we fetched in the last ~60s.
        const cache = caches.default;
        const cacheKey = new Request(url.toString(), request);
        const cached = await cache.match(cacheKey);

        if (cached) {
            const resp = new Response(cached.body, cached);
            Object.entries(corsHeaders).forEach(([k, v]) => resp.headers.set(k, v));
            return resp;
        }

        try {

            const token = await getAccessToken(env);

            const raw = await fetchPrices(
                [ACTUAL_SCHEDULE, FORECAST_SCHEDULE],
                token
            );

            const prices = toTimeSeries(raw, node);

            const payload = {
                node,
                generatedAt: new Date().toISOString(),
                prices
            };

            const response = json(payload, 200, {
                ...corsHeaders,
                "Cache-Control": "public, max-age=60"
            });

            ctx.waitUntil(cache.put(cacheKey, response.clone()));

            return response;

        } catch (err) {

            return json(
                { error: "Upstream fetch failed", detail: String(err) },
                502,
                corsHeaders
            );

        }

    }

};

async function getAccessToken(env) {

    if (cachedToken && Date.now() < cachedTokenExpiry) {
        return cachedToken;
    }

    const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: env.WITS_CLIENT_ID,
            client_secret: env.WITS_CLIENT_SECRET
        })
    });

    if (!res.ok) {
        throw new Error(`Token request failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();

    cachedToken = data.access_token;
    // Refresh a minute early to be safe.
    cachedTokenExpiry = Date.now() + ((data.expires_in || 300) - 60) * 1000;

    return cachedToken;

}

// Documented example query, extended with `node` and `runType` — the docs
// only showed `schedules` + `marketType` as arguments, so `node` here is
// an assumption. If the live query errors on an unknown `node` argument,
// drop it from the query below and rely on the client-side filter in
// toTimeSeries() instead (which happens regardless, as a safety net).

async function fetchPrices(schedules, token) {

    const query = `
        {
            prices(
                schedules: ${JSON.stringify(schedules)}
                marketType: ${MARKET_TYPE}
            ) {
                schedule
                runType
                tradingDateTime
                tradingPeriod
                marketType
                island
                node
                price
            }
        }
    `;

    const res = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ query })
    });

    if (!res.ok) {
        throw new Error(`GraphQL request failed: ${res.status} ${await res.text()}`);
    }

    const body = await res.json();

    if (body.errors?.length) {
        throw new Error(`GraphQL errors: ${JSON.stringify(body.errors)}`);
    }

    return body?.data?.prices || [];

}

// Every row from RTD and PRSL is real, usable data — there's no
// draft/final distinction to filter within a schedule. RTD gives 5-min
// actual dispatch prices; PRSL gives one forecast row per trading period.
// Where their time ranges overlap (the schedule right around "now"),
// actual dispatch data wins — it's ground truth, the forecast isn't.

function toTimeSeries(items, node) {

    const byTime = new Map();

    const insert = item => {

        const time = parseTradingDateTime(item.tradingDateTime);
        const price = normalisePrice(item.price);

        if (time && Number.isFinite(price))
            byTime.set(time, price);

    };

    const relevant = items.filter(item => item.node === node);

    // Forecast first, actual overwrites on any overlapping timestamp.
    relevant.filter(i => i.schedule === FORECAST_SCHEDULE).forEach(insert);
    relevant.filter(i => i.schedule === ACTUAL_SCHEDULE).forEach(insert);

    return Array.from(byTime.entries())
        .map(([time, price]) => ({ time, price }))
        .sort((a, b) => new Date(a.time) - new Date(b.time));

}

// tradingDateTime's exact format isn't confirmed yet — it may arrive with
// an explicit offset/Z (easy case), or as a naive "wall clock" string with
// no timezone marker at all, in which case it needs to be treated as NZ
// local time. Rather than hardcoding +12/+13, this asks the JS runtime's
// own Pacific/Auckland rules what the correct offset was for that exact
// date (correctly handling the DST transition boundary either way).

function parseTradingDateTime(value) {

    if (!value)
        return null;

    const hasOffset = /Z$|[+-]\d{2}:?\d{2}$/.test(value);

    if (hasOffset)
        return new Date(value).toISOString();

    return nzLocalToIso(value);

}

function nzLocalToIso(naiveLocal) {

    // Parse the naive string as if it were UTC — gives us a Date object
    // carrying the right numbers, instant-wise meaningless for now.
    const asIfUtc = new Date(naiveLocal.replace(" ", "T") + "Z");

    if (isNaN(asIfUtc))
        return null;

    // Ask what wall-clock time that instant actually is in Auckland —
    // the gap between the two tells us the real offset at that moment.
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Pacific/Auckland",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hourCycle: "h23"
    }).formatToParts(asIfUtc).reduce((acc, p) => {
        acc[p.type] = p.value;
        return acc;
    }, {});

    const aucklandAsUtc = Date.UTC(
        Number(parts.year), Number(parts.month) - 1, Number(parts.day),
        Number(parts.hour), Number(parts.minute), Number(parts.second)
    );

    const offsetMs = aucklandAsUtc - asIfUtc.getTime();

    return new Date(asIfUtc.getTime() - offsetMs).toISOString();

}

function normalisePrice(rawPrice) {

    // Confirmed: prices from electricityinfo.co.nz are NZD per MWh.
    // Convert to c/kWh (the app's unit) by dividing by 10.
    return Number((Number(rawPrice) / 10).toFixed(2));

}

function buildCorsHeaders(origin, env) {

    const allowed = env.ALLOWED_ORIGIN || "*";
    const allowOrigin = allowed === "*" || origin === allowed ? origin || "*" : allowed;

    return {
        "Access-Control-Allow-Origin": allowOrigin,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Vary": "Origin"
    };

}

function json(payload, status, headers) {

    return new Response(JSON.stringify(payload), {
        status,
        headers: { "Content-Type": "application/json", ...headers }
    });

}
