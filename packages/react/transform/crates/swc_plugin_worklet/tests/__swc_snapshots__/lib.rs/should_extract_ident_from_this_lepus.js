import "@lynx-js/react/worklet-runtime/init?owner=a123-test";
let onTapLepus = {
    _wkltId: "a123:test:1",
    ...{
        a: this.a
    }
};
registerWorkletInternal("main-thread", "a123:test:1", function(event: ReactLynx.Worklet.ITouchEvent) {
    const onTapLepus = lynxWorkletImpl._workletMap["a123:test:1"].bind(this);
    "main thread";
    let a = 1;
    this.a;
});
