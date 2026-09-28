import "@lynx-js/react/worklet-runtime/init";
let onTapLepus = {
    _c: {
        g
    },
    _wkltId: "a123:test:1"
};
registerWorkletInternal("main-thread", "a123:test:1", function(event: ReactLynx.Worklet.ITouchEvent) {
    const onTapLepus = lynxWorkletImpl._workletMap["a123:test:1"].bind(this);
    let { g } = this["_c"];
    "main thread";
    try {} catch (e) {}
    try {} catch ({ f, g }) {}
    g;
});
