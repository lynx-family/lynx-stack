import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
var loadWorkletRuntime = __loadWorkletRuntime;
let onTapLepus = {
    _wkltId: "a77b:test:1"
};
loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "a77b:test:1", function(event: ReactLynx.Worklet.ITouchEvent) {
    const onTapLepus = lynxWorkletImpl._workletMap["a77b:test:1"].bind(this);
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
