class MockDataSource {

    constructor() {

        this.intervalMinutes = CONFIG.intervalMinutes;
        this.pointsPerHour = 60 / this.intervalMinutes;

        this.data = [];
        this.generate();

    }

    generate() {

        this.data = [];

        const now = new Date();

        const start = new Date(now);

        start.setHours(
            start.getHours() - CONFIG.historyHours,
            0,
            0,
            0
        );

        const totalPoints =
            (CONFIG.historyHours + CONFIG.forecastHours)
            * this.pointsPerHour;

        for (let i = 0; i <= totalPoints; i++) {

            const timestamp = new Date(
                start.getTime() +
                i * this.intervalMinutes * 60000
            );

            this.data.push({
                time: timestamp,
                price: this.generatePrice(timestamp)
            });

        }

    }

    generatePrice(date) {

        const h =
            date.getHours() +
            date.getMinutes() / 60;

        let p = 5.0;

        // Overnight cheap

        p +=
            this.gaussian(h, 2.5, 2.5, -2.5);

        // Morning demand

        p +=
            this.gaussian(h, 8.0, 1.5, 8);

        // Lunchtime softening

        p +=
            this.gaussian(h, 13.0, 2.2, -1.8);

        // Evening peak

        p +=
            this.gaussian(h, 18.5, 2.0, 14);

        // Gentle daily variation

        p +=
            Math.sin(
                (date.getTime() / 1000) / 24000
            ) * 1.2;

        // Slow market movement

        p +=
            Math.sin(
                (date.getTime() / 1000) / 5000
            ) * 0.8;

        // Occasional spikes

        const seed =
            Math.sin(date.getTime() / 600000);

        if (seed > 0.985) {

            p +=
                20 +
                (seed - 0.985) * 900;

        }

        return Math.max(
            0,
            Number(p.toFixed(1))
        );

    }

    gaussian(x, centre, width, height) {

        return height *
            Math.exp(
                -Math.pow(x - centre, 2) /
                (2 * width * width)
            );

    }

    getData() {

        return this.data;

    }

    getCurrentIndex() {

        // Same fix as LiveDataSource: prefer the latest point at or
        // before now, not whichever point is nearest in either
        // direction — keeps mock and live behaviour consistent.

        const now = Date.now();

        let lastPastIndex = -1;

        for (let i = 0; i < this.data.length; i++) {

            if (this.data[i].time.getTime() <= now)
                lastPastIndex = i;
            else
                break;

        }

        return lastPastIndex >= 0 ? lastPastIndex : 0;

    }

    getCurrentPrice() {

        return this.data[
            this.getCurrentIndex()
        ].price;

    }

    refresh() {

        this.generate();

    }

}

window.mockSource = new MockDataSource();