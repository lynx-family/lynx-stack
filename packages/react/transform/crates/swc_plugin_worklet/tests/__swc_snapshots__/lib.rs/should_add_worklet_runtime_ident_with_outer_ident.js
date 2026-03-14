import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
var loadWorkletRuntime = __loadWorkletRuntime;
const __workletRuntimeLoaded = false;
console.log(__workletRuntimeLoaded);
let foo = {
    _wkltId: "a123:test:1"
};
const __workletRuntimeLoaded1 = loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry);
__workletRuntimeLoaded1 && registerWorkletInternal("main-thread", "a123:test:1", function() {
    const foo = lynxWorkletImpl._workletMap["a123:test:1"].bind(this);
    "main thread";
    return 1;
});
