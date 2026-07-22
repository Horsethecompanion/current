const CONFIG = {

    // Timeline

    defaultTimelineHours: 4,

    zoomedTimelineHours: 24,

    zoomLerpSpeed: 4,



    // Refresh

    refreshIntervalSeconds: 60,



    // Night mode

    autoNightMode: true,

    nightStartHour: 22,

    nightEndHour: 6,



    // Animation

    animationFPS: 60,

    transitionDuration: 600,



    // Time division marks

    timeMarks: {

        minorHeight: 8,
        majorHeight: 14,

        minorColour: "rgba(255,255,255,.22)",
        majorColour: "rgba(255,255,255,.45)",

        majorEveryHours: 6

    },



    // Price display

    units: "c/kWh",

    decimals: 1,



    // Data source
    // Flip to false once the worker is deployed and workerUrl is set below.

    useMockData: false,

    workerUrl: "https://current-prices.current-prices.workers.dev",

    gxpNode: "ALB0331", // Albany GXP — North Shore

    retailMargin: 0, // c/kWh, added on top of wholesale. Leave 0 for now.

    dataRefreshSeconds: 60, // how often to poll the worker (worker itself caches upstream ~60s)


    // Mock / synthetic timeline shape (also used to size the live dataset)

    historyHours: 24,

    forecastHours: 24,

    intervalMinutes: 30,



    // Colour scale (c/kWh)
    //
    // NZ wholesale prices normally sit in the 5-25 c/kWh range but can
    // spike into the hundreds or low thousands during scarcity events.
    // A plain linear scale either wastes resolution on the rare extreme
    // end, or saturates to the same dark red for "a bit pricey" and
    // "genuinely extreme" alike. Instead, priceScale below warps price
    // through a piecewise linear→log curve before it's mapped onto the
    // stops: the normal daily range gets most of the visual travel,
    // and the log tail still keeps real spikes visually distinct from
    // each other rather than clamping to one colour.

    priceScale: {

        linearMax: 25,      // c/kWh — top of the "normal" daily range
        spikeMax: 1000,     // c/kWh — anything at/above this maxes out
        linearFraction: 0.7 // portion of the visual scale given to 0..linearMax

    },

    colourStops: [

        { value: 0,    colour: "#156b37" },

        { value: 5,    colour: "#2f9f4b" },

        { value: 10,   colour: "#89c541" },

        { value: 15,   colour: "#d6c73a" },

        { value: 20,   colour: "#d9b530" },

        { value: 30,   colour: "#d77b2a" },

        { value: 45,   colour: "#cf4c2e" },

        { value: 80,   colour: "#7d1f1f" },

        { value: 250,  colour: "#5c1420" },

        { value: 1000, colour: "#200308" }

    ]

};



const STATE = {

    timelineHours: CONFIG.defaultTimelineHours,

    displayedTimelineHours: CONFIG.defaultTimelineHours,

    nightModeOverride: null,

    lastUpdate: null,

    connected: true,

    currentPrice: 0,

    currentIndex: 0,

    dataset: []

};