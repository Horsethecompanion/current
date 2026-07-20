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
                `${CONFIG.workerUrl}/prices?node=${CONFIG.gxpNode}`;

            const res = await fetch(url, {
                cache: "no-store"
            });

            if (!res.ok)
                throw new Error(`Worker returned ${res.status}`);

            const json = await res.json();

            if (!Array.isArray(json.prices) || json.prices.length === 0)
                throw new Error("Empty price dataset");

            this.data = json.prices.map(p => ({
                time: new Date(p.time),
                price: this.applyMargin(p.price)
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

    applyMargin(wholesalePrice) {

        return Number(
            (wholesalePrice + CONFIG.retailMargin).toFixed(2)
        );

    }

    getData() {

        return this.data;

    }

    getCurrentIndex() {

        const now = new Date();

        let nearest = 0;
        let distance = Infinity;

        this.data.forEach((d, i) => {

            const diff = Math.abs(d.time.getTime() - now.getTime());

            if (diff < distance) {

                distance = diff;
                nearest = i;

            }

        });

        return nearest;

    }

    getCurrentPrice() {

        if (this.data.length === 0)
            return 0;

        return this.data[this.getCurrentIndex()].price;

    }

}
