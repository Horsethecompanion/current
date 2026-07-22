const priceElement = document.getElementById("price");
const updatedElement = document.getElementById("updated");
const statusElement = document.getElementById("status");
const hoursLeftElement = document.getElementById("hoursLeft");
const hoursRightElement = document.getElementById("hoursRight");

const dataSource = CONFIG.useMockData
    ? window.mockSource
    : new LiveDataSource();

let displayedPrice = 0;
let targetPrice = 0;

let lastFrame = performance.now();

function withMargin(data) {

    const margin = getRetailMargin();

    if (margin === 0)
        return data;

    return data.map(d => ({
        time: d.time,
        price: Number((d.price + margin).toFixed(2))
    }));

}

function animate(now) {

    const dt = (now - lastFrame) / 1000;
    lastFrame = now;

    // ----- Data -----

    const data = withMargin(dataSource.getData());
    const currentIndex = dataSource.getCurrentIndex();

    targetPrice = data[currentIndex].price;

    renderer.draw(data);

    updateStatus();

    // ----- Smooth number animation -----

    displayedPrice += (targetPrice - displayedPrice) * Math.min(dt * 5, 1);

    priceElement.textContent =
        displayedPrice.toFixed(CONFIG.decimals);

    // ----- Time -----

    const t = new Date();

    updatedElement.textContent =
        t.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });

    // ----- Night mode -----

    updateNightMode();

    // ----- Animated zoom -----

    STATE.displayedTimelineHours +=
        (STATE.timelineHours - STATE.displayedTimelineHours) *
        Math.min(dt * CONFIG.zoomLerpSpeed, 1);

    const shownHours = Math.round(STATE.displayedTimelineHours);

    hoursLeftElement.textContent = `−${shownHours}h`;
    hoursRightElement.textContent = `+${shownHours}h`;

    requestAnimationFrame(animate);

}

requestAnimationFrame(animate);


//------------------------------------------------------------
// Refresh data on an interval
//------------------------------------------------------------

const refreshSeconds = CONFIG.useMockData
    ? CONFIG.refreshIntervalSeconds
    : CONFIG.dataRefreshSeconds;

setInterval(() => {

    dataSource.refresh();

}, refreshSeconds * 1000);


//------------------------------------------------------------
// Status dot: green = live, amber = stale (no fresh fetch yet
// but still showing last known data), handled via CSS classes
//------------------------------------------------------------

function updateStatus() {

    if (CONFIG.useMockData) {

        statusElement.classList.remove("stale");
        return;

    }

    statusElement.classList.toggle("stale", !STATE.connected);

}


//------------------------------------------------------------
// Tap to zoom
//------------------------------------------------------------

document.body.addEventListener("click", () => {

    if (!settingsOverlay.classList.contains("hidden"))
        return;

    if (suppressNextClick) {

        suppressNextClick = false;
        return;

    }

    STATE.timelineHours =
        STATE.timelineHours === CONFIG.defaultTimelineHours
            ? CONFIG.zoomedTimelineHours
            : CONFIG.defaultTimelineHours;

});


//------------------------------------------------------------
// Two-finger tap = manual night mode toggle
//------------------------------------------------------------

let touchTimer = null;

document.body.addEventListener("touchstart", (e) => {

    if (e.touches.length !== 2)
        return;

    e.preventDefault();

    clearTimeout(touchTimer);

    touchTimer = setTimeout(() => {

        if (STATE.nightModeOverride === null)
            STATE.nightModeOverride = true;
        else if (STATE.nightModeOverride === true)
            STATE.nightModeOverride = false;
        else
            STATE.nightModeOverride = null;

        applyNightMode();

    }, 100);

}, { passive:false });


//------------------------------------------------------------
// Automatic night mode
//------------------------------------------------------------

function updateNightMode() {

    if (STATE.nightModeOverride !== null) {

        applyNightMode();

        return;

    }

    const hour = new Date().getHours();

    const night =

        hour >= CONFIG.nightStartHour ||

        hour < CONFIG.nightEndHour;

    document.body.classList.toggle("night", night);

}

function applyNightMode() {

    if (STATE.nightModeOverride === null) {

        document.body.classList.remove("night");

        return;

    }

    document.body.classList.toggle(

        "night",

        STATE.nightModeOverride

    );

}

//------------------------------------------------------------
// Long-press = open Settings (location + retail margin).
// Two-finger tap is already night mode, single tap is already zoom —
// long-press on an otherwise-unused gesture keeps the "no visible
// buttons" look intact.
//------------------------------------------------------------

const settingsOverlay = document.getElementById("settingsOverlay");
const knownNodesEl = document.getElementById("knownNodes");
const customNodeInput = document.getElementById("customNode");
const marginInputEl = document.getElementById("marginInput");

let pressTimer = null;
let suppressNextClick = false;

const LONG_PRESS_MS = 600;
const MOVE_CANCEL_PX = 12;

let pressStart = null;

document.body.addEventListener("pointerdown", (e) => {

    if (e.target.closest("#settingsOverlay"))
        return;

    pressStart = { x: e.clientX, y: e.clientY };

    pressTimer = setTimeout(() => {

        suppressNextClick = true;
        openSettings();

    }, LONG_PRESS_MS);

});

document.body.addEventListener("pointermove", (e) => {

    if (!pressStart)
        return;

    const dx = e.clientX - pressStart.x;
    const dy = e.clientY - pressStart.y;

    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX)
        clearTimeout(pressTimer);

});

["pointerup", "pointercancel"].forEach(evt =>

    document.body.addEventListener(evt, () => {

        clearTimeout(pressTimer);
        pressStart = null;

    })

);


function openSettings() {

    renderKnownNodes();

    marginInputEl.value = getRetailMargin();

    settingsOverlay.classList.remove("hidden");

}

function closeSettings() {

    settingsOverlay.classList.add("hidden");

}

document.getElementById("closeSettings").addEventListener("click", closeSettings);

settingsOverlay.addEventListener("click", (e) => {

    if (e.target === settingsOverlay)
        closeSettings();

});


function renderKnownNodes() {

    const current = getSelectedNode();

    knownNodesEl.innerHTML = "";

    KNOWN_NODES.forEach(node => {

        const btn = document.createElement("button");

        btn.type = "button";
        btn.className = "node-option" + (node.code === current ? " selected" : "");
        btn.textContent = `${node.name} — ${node.code}`;

        btn.addEventListener("click", () => {

            setSelectedNode(node.code);
            renderKnownNodes();
            dataSource.refresh?.();

        });

        knownNodesEl.appendChild(btn);

    });

}

document.getElementById("useMyLocation").addEventListener("click", () => {

    if (!("geolocation" in navigator)) {

        alert("Geolocation isn't available in this browser.");
        return;

    }

    navigator.geolocation.getCurrentPosition(

        (pos) => {

            const nearest = nearestNode(
                pos.coords.latitude,
                pos.coords.longitude
            );

            if (!nearest) {

                alert("No known nodes to match against yet — add one, or enter your GXP code directly below.");
                return;

            }

            setSelectedNode(nearest.code);
            renderKnownNodes();
            dataSource.refresh?.();

        },

        () => alert("Couldn't get your location — check permissions, or enter your GXP code directly below."),

        { timeout: 10000 }

    );

});

document.getElementById("applyCustomNode").addEventListener("click", () => {

    const code = customNodeInput.value.trim();

    if (!code)
        return;

    setSelectedNode(code);
    customNodeInput.value = "";
    renderKnownNodes();
    dataSource.refresh?.();

});

document.getElementById("applyMargin").addEventListener("click", () => {

    const value = Number(marginInputEl.value);

    setRetailMargin(Number.isFinite(value) ? value : 0);

});
