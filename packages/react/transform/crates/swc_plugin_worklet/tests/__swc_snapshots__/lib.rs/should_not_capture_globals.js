import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
var loadWorkletRuntime = __loadWorkletRuntime;
let Y = {
    _wkltId: "a77b:test:1"
};
const __workletRuntimeLoaded = loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry);
__workletRuntimeLoaded && registerWorkletInternal("main-thread", "a77b:test:1", function() {
    const Y = lynxWorkletImpl._workletMap["a77b:test:1"].bind(this);
    "main thread";
    console.log(111);
    setTimeout(()=>{});
    lynx.querySelector();
    SystemInfo.version;
    myCustomGlobal;
});
