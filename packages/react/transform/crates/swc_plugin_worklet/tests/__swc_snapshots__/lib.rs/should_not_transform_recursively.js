import "@lynx-js/react/worklet-runtime";
let X = {
    _c: {
        y1,
        y2,
        z1,
        z2
    },
    _wkltId: "a77b:test:1"
};
registerWorkletInternal("main-thread", "a77b:test:1", function() {
    const X = lynxWorkletImpl._workletMap["a77b:test:1"].bind(this);
    let { y1, y2, z1, z2 } = this["_c"];
    "main thread";
    console.log(y1[y2 + 1]);
    function Y() {
        "main thread";
        console.log(y1[y2 + 1]);
        console.log(z1[z2 + 1]);
    }
});
