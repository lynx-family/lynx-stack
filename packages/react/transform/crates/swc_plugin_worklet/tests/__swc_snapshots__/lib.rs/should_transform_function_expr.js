import "@lynx-js/react/worklet-runtime";
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
