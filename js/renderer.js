class Renderer {

    constructor() {

        this.canvas = document.getElementById("heatmap");
        this.ctx = this.canvas.getContext("2d");

        this.width = 0;
        this.height = 0;

        window.addEventListener("resize", () => this.resize());

        this.resize();

        // Precompute each colour stop's warped position once — getColour()
        // runs many times per frame (multiple samples per timeline segment),
        // so this avoids redoing the log math on every call.

        this.scaleStops = CONFIG.colourStops.map(s => ({
            pos: this.priceToScale(s.value),
            colour: s.colour
        }));

    }

    resize() {

        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.canvas.width = this.width;
        this.canvas.height = this.height;

    }

draw(dataset) {

    const ctx = this.ctx;

    ctx.clearRect(0,0,this.width,this.height);

    const now = Date.now();

    for (let i=0;i<dataset.length-1;i++) {

        const a = dataset[i];
        const b = dataset[i+1];

        const x1 = this.timeToX(
            now,
            a.time.getTime()
        );

        const x2 = this.timeToX(
            now,
            b.time.getTime()
        );

        if (x2 < 0 || x1 > this.width)
            continue;

        const gradient =
            ctx.createLinearGradient(
                x1,
                0,
                x2,
                0
            );

        const gradientSteps = 4;

        for (let s = 0; s <= gradientSteps; s++) {

            const t = s / gradientSteps;

            const price =
                a.price + (b.price - a.price) * t;

            gradient.addColorStop(
                t,
                this.getColour(price)
            );

        }

        ctx.fillStyle = gradient;

        ctx.fillRect(
            x1,
            0,
            x2 - x1 + 1,
            this.height
        );

    }

    this.drawCentreLine();

    this.drawTimeMarks(now);

}

samplePrice(dataset, targetTime) {

    for (let i = 0; i < dataset.length - 1; i++) {

        const a = dataset[i];
        const b = dataset[i + 1];

        if (
            targetTime >= a.time.getTime() &&
            targetTime <= b.time.getTime()
        ) {

            const t =
                (targetTime - a.time.getTime()) /
                (b.time.getTime() - a.time.getTime());

            return a.price +
                (b.price - a.price) * t;

        }

    }

    return dataset[dataset.length - 1].price;

}

    drawCentreLine() {

        const ctx = this.ctx;

        ctx.strokeStyle = "rgba(255,255,255,.18)";
        ctx.lineWidth = 2;

        ctx.beginPath();

        ctx.moveTo(this.width / 2, 0);
        ctx.lineTo(this.width / 2, this.height);

        ctx.stroke();

    }

drawTimeMarks(now) {

    const ctx = this.ctx;
    const marks = CONFIG.timeMarks;

    const spanMs = STATE.displayedTimelineHours * 60 * 60000;

    const startTime = now - spanMs;
    const endTime = now + spanMs;

    // First hour boundary at or after startTime

    const first = new Date(startTime);
    first.setMinutes(0, 0, 0);

    if (first.getTime() < startTime)
        first.setHours(first.getHours() + 1);

    ctx.save();
    ctx.lineWidth = 1.5;

    for (let t = first.getTime(); t <= endTime; t += 3600000) {

        const x = this.timeToX(now, t);

        if (x < 0 || x > this.width)
            continue;

        const isMajor =
            new Date(t).getHours() % marks.majorEveryHours === 0;

        ctx.strokeStyle = isMajor
            ? marks.majorColour
            : marks.minorColour;

        const h = isMajor
            ? marks.majorHeight
            : marks.minorHeight;

        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();

    }

    ctx.restore();

}

    getColour(value) {

        const stops = this.scaleStops;

        const pos = this.priceToScale(value);

        if (pos <= stops[0].pos)
            return stops[0].colour;

        if (pos >= stops[stops.length - 1].pos)
            return stops[stops.length - 1].colour;

        for (let i = 0; i < stops.length - 1; i++) {

            const a = stops[i];
            const b = stops[i + 1];

            if (pos >= a.pos && pos <= b.pos) {

                const t = (pos - a.pos) / (b.pos - a.pos);

                return this.interpolate(
                    a.colour,
                    b.colour,
                    t
                );

            }

        }

        return "#000";

    }

    // Piecewise linear→log warp: 0..linearMax gets linearFraction of the
    // visual scale (as a straight line), everything above compresses
    // logarithmically out to spikeMax so rare extreme prices stay
    // distinguishable instead of clamping to one colour.

    priceToScale(value) {

        const { linearMax, spikeMax, linearFraction } = CONFIG.priceScale;

        const v = Math.min(Math.max(value, 0), spikeMax);

        if (v <= linearMax)
            return (v / linearMax) * linearFraction;

        const logRange = Math.log(spikeMax / linearMax);
        const t = Math.log(v / linearMax) / logRange;

        return linearFraction + (1 - linearFraction) * t;

    }

    interpolate(a, b, t) {

        const la = this.hexToOklab(a);
        const lb = this.hexToOklab(b);

        const L = la.L + (lb.L - la.L) * t;
        const A = la.a + (lb.a - la.a) * t;
        const B = la.b + (lb.b - la.b) * t;

        return this.oklabToHex(L, A, B);

    }

    // ---------- OKLab colour space helpers ----------
    // (Björn Ottosson's OKLab; used instead of raw RGB
    //  lerp so colour transitions stay vivid rather than
    //  passing through a muddy grey/brown midpoint.)

    srgbToLinear(c) {

        c /= 255;

        return c <= 0.04045
            ? c / 12.92
            : Math.pow((c + 0.055) / 1.055, 2.4);

    }

    linearToSrgb(c) {

        c = c <= 0.0031308
            ? 12.92 * c
            : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

        return Math.round(
            Math.min(Math.max(c, 0), 1) * 255
        );

    }

    hexToOklab(hex) {

        const h = hex.replace("#", "");

        const r = this.srgbToLinear(parseInt(h.substring(0, 2), 16));
        const g = this.srgbToLinear(parseInt(h.substring(2, 4), 16));
        const b = this.srgbToLinear(parseInt(h.substring(4, 6), 16));

        const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
        const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
        const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

        const l_ = Math.cbrt(l);
        const m_ = Math.cbrt(m);
        const s_ = Math.cbrt(s);

        return {
            L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
            a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
            b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
        };

    }

    oklabToHex(L, a, b) {

        const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
        const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
        const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

        const l = l_ * l_ * l_;
        const m = m_ * m_ * m_;
        const s = s_ * s_ * s_;

        const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
        const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
        const bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

        const toHex = (c) =>
            this.linearToSrgb(c).toString(16).padStart(2, "0");

        return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;

    }

timeToX(currentTime, targetTime) {

    const minutes =
        (targetTime - currentTime) / 60000;

    const pixelsPerMinute =
        this.width /
        (STATE.displayedTimelineHours * 2 * 60);

    return this.width / 2 +
        minutes * pixelsPerMinute;

}
}

window.renderer = new Renderer();