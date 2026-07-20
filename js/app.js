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

function animate(now) {

    const dt = (now - lastFrame) / 1000;
    lastFrame = now;

    // ----- Data -----

    const data = dataSource.getData();
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