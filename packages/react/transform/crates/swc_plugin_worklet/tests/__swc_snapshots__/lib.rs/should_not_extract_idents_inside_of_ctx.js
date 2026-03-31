import "@lynx-js/react/worklet-runtime";
let onTapLepus = {
    _wkltId: "a123:test:1"
};
registerWorkletInternal("main-thread", "a123:test:1", function(event: ReactLynx.Worklet.ITouchEvent) {
    const onTapLepus = lynxWorkletImpl._workletMap["a123:test:1"].bind(this);
    "main thread";
    if (true) {
        let a = 1;
        a;
    }
    function f(e) {
        f;
        e;
    }
    if (true) {
        var b = 1;
        b;
    }
    b;
    f;
});
