import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
var loadWorkletRuntime = __loadWorkletRuntime;
let X = {
    _c: {
        y1,
        y2
    },
    _wkltId: "a77b:test:1"
};
let Y = {
    _c: {
        z1,
        z2
    },
    _wkltId: "a77b:test:2"
};
const __workletRuntimeLoaded = loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry);
__workletRuntimeLoaded && registerWorkletInternal("main-thread", "a77b:test:1", function(event) {
    const X = lynxWorkletImpl._workletMap["a77b:test:1"].bind(this);
    let { y1, y2 } = this["_c"];
    "main thread";
    console.log(y1[y2 + 1]);
});
__workletRuntimeLoaded && registerWorkletInternal("main-thread", "a77b:test:2", function(event) {
    const Y = lynxWorkletImpl._workletMap["a77b:test:2"].bind(this);
    let { z1, z2 } = this["_c"];
    "main thread";
    console.log(z1[z2 + 1]);
});
