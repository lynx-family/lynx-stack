import { loadWorkletRuntime as __loadWorkletRuntime, workletCapture as __workletCapture } from "@lynx-js/react";
var loadWorkletRuntime = __loadWorkletRuntime, workletCapture = __workletCapture;
let onTapLepus = {
    _wkltId: "a123:test:1",
    ...{
        a: this.a
    }
};
loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "a123:test:1", function(event: ReactLynx.Worklet.ITouchEvent) {
    const onTapLepus = lynxWorkletImpl._workletMap["a123:test:1"].bind(this);
    "main thread";
    let a = 1;
    this.a;
});
