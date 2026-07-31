class LiveDataSource {

    constructor() {

        this.data = [];
        this.lastFetchOk = false;

        // Seed with mock data immediately so the display isn't empty
        // while the first real fetch is in flight.

        this.fallback = new MockDataSource();
        this.data = this.fallback.getData();

        this.refresh();

    }

    async refresh() {

        try {

            const url =
                `${CONFIG.workerUrl}/prices?node=${getSelectedNode()}`;

            const res = await fetch(url, {
                cache: "no-store"
            });

            if (!res.ok)
                throw new Error(`Worker returned ${res.status}`);

            const json = await res.json();

            if (!Array.isArray(json.prices) || json.prices.length === 0)
                throw new Error("Empty price dataset");

            // Wholesale prices only — retail margin is applied as a
            // display-layer transform in app.js, not baked in here, so
            // changing the margin doesn't require a re-fetch.

            this.data = json.prices.map(p => ({
                time: new Date(p.time),
                price: p.price
            }));

            this.lastFetchOk = true;
            STATE.connected = true;
            STATE.lastUpdate = new Date();

        } catch (err) {

            console.warn("Live data fetch failed, holding last known data:", err);

            this.lastFetchOk = false;
            STATE.connected = false;

            // Keep whatever data we already have (don't blank the screen).
            // If we've never had a successful fetch, fall back to mock
            // so the app is at least visibly alive.

            if (this.data.length === 0) {

                this.fallback.refresh();
                this.data = this.fallback.getData();

            }

        }

    }

    getData() {

        return this.data;

    }

    getCurrentIndex() {

        // "Current" should mean the latest known reading, not whichever
        // point happens to be closest in time — a forecast for an
        // upcoming period can sit chronologically nearer to "now" than
        // the most recent actual dispatch price (actuals lag a few
        // minutes behind real time), and picking it would show a
        // speculative forecast as if it were live. So: walk forward and
        // keep the last point at or before now; data is sorted
        // ascending, so the first point we hit in the future ends it.

        const now = Date.now();

        let lastPastIndex = -1;

        for (let i = 0; i < this.data.length; i++) {

            if (this.data[i].time.getTime() <= now)
                lastPastIndex = i;
            else
                break;

        }

        // Only happens if every point is somehow in the future — fall
        // back to the earliest available rather than returning nothing.
        return lastPastIndex >= 0 ? lastPastIndex : 0;

    }

    getCurrentPrice() {

        if (this.data.length === 0)
            return 0;

        return this.data[this.getCurrentIndex()].price;

    }

}
