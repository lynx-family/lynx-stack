(async function() {
    await import(/* webpackChunkName: "comp-react__background" */ "./comp.js");
    await import(/* webpackPrefetch: true */ "./other.js");
    await import("./plain.js");
})();
