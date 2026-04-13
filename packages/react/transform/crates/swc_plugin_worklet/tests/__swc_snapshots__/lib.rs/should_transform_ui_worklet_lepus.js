import "@lynx-js/react/worklet-runtime/init?owner=a123-test";
let onTapLepus = {
    _c: {
        a
    },
    _wkltId: "a123:test:1"
};
registerWorkletInternal("ui", "a123:test:1", function(event: ReactLynx.Worklet.ITouchEvent) {
    const onTapLepus = lynxWorkletImpl._workletMap["a123:test:1"].bind(this);
    let { a } = this["_c"];
    "use worklet";
    a;
});
