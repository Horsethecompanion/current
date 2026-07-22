// GXP codes below are matched against WITS's own official POC reference
// list (the dropdown WITS itself uses), not guessed from naming
// conventions — so the code-to-place mapping is authoritative. One
// caveat: only Albany has actually been fetch-tested against the live
// /prices endpoint end-to-end. The others are almost certainly fine
// (these are all major, actively-traded GXPs), but if one comes back
// empty, that fails safely — the app just shows the amber "stale" dot
// and holds the last good data, it won't show silently-wrong numbers.
// If you hit one that doesn't work, the "Custom GXP code" field below
// still works as a fallback while it gets sorted out.

const KNOWN_NODES = [

    { name: "Albany (North Shore, Auckland)",   code: "ALB0331", lat: -36.7280, lon: 174.7000 },
    { name: "Penrose (Central Auckland)",       code: "PEN0331", lat: -36.9010, lon: 174.8150 },
    { name: "Hamilton",                         code: "HAM0331", lat: -37.7870, lon: 175.2793 },
    { name: "Tauranga",                         code: "TGA0331", lat: -37.6878, lon: 176.1651 },
    { name: "Rotorua",                          code: "ROT0331", lat: -38.1368, lon: 176.2497 },
    { name: "Napier / Hastings (Redclyffe)",    code: "RDF0331", lat: -39.4928, lon: 176.8973 },
    { name: "New Plymouth",                     code: "NPL0331", lat: -39.0556, lon: 174.0752 },
    { name: "Palmerston North (Bunnythorpe)",   code: "BPE0331", lat: -40.3523, lon: 175.6110 },
    { name: "Wellington (Haywards)",            code: "HAY0331", lat: -41.2044, lon: 174.9346 },
    { name: "Nelson (Stoke)",                   code: "STK0331", lat: -41.3159, lon: 173.2740 },
    { name: "Blenheim",                         code: "BLN0331", lat: -41.5134, lon: 173.9612 },
    { name: "Christchurch (Islington)",         code: "ISL0331", lat: -43.5320, lon: 172.6306 },
    { name: "Dunedin (Halfway Bush)",           code: "HWB0331", lat: -45.8788, lon: 170.4630 },
    { name: "Queenstown (Frankton)",            code: "FKN0331", lat: -45.0312, lon: 168.7420 },
    { name: "Invercargill",                     code: "INV0331", lat: -46.4132, lon: 168.3538 }

];


//------------------------------------------------------------
// Settings persistence — localStorage-backed, with CONFIG defaults as
// the fallback. Kept in one place so livedata.js and app.js both read
// the same resolved values without needing to know about localStorage.
//------------------------------------------------------------

const SETTINGS_KEYS = {
    node: "current_node_code",
    margin: "current_retail_margin"
};

function getSelectedNode() {

    return localStorage.getItem(SETTINGS_KEYS.node) || CONFIG.gxpNode;

}

function setSelectedNode(code) {

    localStorage.setItem(SETTINGS_KEYS.node, code.trim().toUpperCase());

}

function getRetailMargin() {

    const stored = localStorage.getItem(SETTINGS_KEYS.margin);

    return stored !== null ? Number(stored) : CONFIG.retailMargin;

}

function setRetailMargin(value) {

    localStorage.setItem(SETTINGS_KEYS.margin, String(value));

}

// Straight-line (haversine) distance in km — plenty accurate for
// "which of a short list of nodes is closest", not for navigation.

function nearestNode(lat, lon) {

    const toRad = deg => deg * Math.PI / 180;

    let best = null;
    let bestDistance = Infinity;

    KNOWN_NODES.forEach(node => {

        const dLat = toRad(node.lat - lat);
        const dLon = toRad(node.lon - lon);

        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat)) * Math.cos(toRad(node.lat)) *
            Math.sin(dLon / 2) ** 2;

        const distance = 2 * Math.asin(Math.sqrt(a)) * 6371;

        if (distance < bestDistance) {

            bestDistance = distance;
            best = node;

        }

    });

    return best;

}
