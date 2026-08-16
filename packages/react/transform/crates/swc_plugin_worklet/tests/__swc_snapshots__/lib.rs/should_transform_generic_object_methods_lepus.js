import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
var loadWorkletRuntime = __loadWorkletRuntime;
const valueType = defineType({
    create: {
        _c: {
            makeValue
        },
        _wkltId: "a77b:test:1"
    },
    dispose: {
        _wkltId: "a77b:test:2"
    }
});
const __workletRuntimeLoaded = loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry);
__workletRuntimeLoaded && registerWorkletInternal("main-thread", "a77b:test:1", function(initialValue: number) {
    const create = lynxWorkletImpl._workletMap["a77b:test:1"].bind(this);
    let { makeValue } = this["_c"];
    "main thread";
    return makeValue(initialValue);
});
__workletRuntimeLoaded && registerWorkletInternal("main-thread", "a77b:test:2", function(value) {
    const dispose = lynxWorkletImpl._workletMap["a77b:test:2"].bind(this);
    "main thread";
    value.stop();
});
