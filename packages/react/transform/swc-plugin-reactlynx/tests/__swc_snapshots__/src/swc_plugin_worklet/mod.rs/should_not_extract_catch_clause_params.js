import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
var loadWorkletRuntime = __loadWorkletRuntime;
let onTapLepus = {
    _c: {
        g
    },
    _wkltId: "a77b:test:1"
};
loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "a77b:test:1", function(event: ReactLynx.Worklet.ITouchEvent) {
    const onTapLepus = lynxWorkletImpl._workletMap["a77b:test:1"].bind(this);
    let { g } = this["_c"];
    "main thread";
    try {} catch (e) {}
    try {} catch ({ f, g }) {}
    g;
});
