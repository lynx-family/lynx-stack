import "@lynx-js/react/worklet-runtime/init?owner=a77b-test";
let X = {
    _c: {
        y1,
        y2
    },
    _wkltId: "a77b:test:1"
};
registerWorkletInternal("main-thread", "a77b:test:1", function(event) {
    let { y1, y2 } = this["_c"];
    "main thread";
    console.log(y1[y2 + 1]);
});
