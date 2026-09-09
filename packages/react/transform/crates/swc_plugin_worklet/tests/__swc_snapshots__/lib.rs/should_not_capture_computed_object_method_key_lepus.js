import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
var loadWorkletRuntime = __loadWorkletRuntime;
const name = 'create';
const valueType = defineMainThreadObjectType({
    type: '@test/value',
    [name]: {
        _wkltId: "a77b:test:1"
    }
});
const __workletRuntimeLoaded = loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry);
__workletRuntimeLoaded && registerWorkletInternal("main-thread", "a77b:test:1", function(initialValue) {
    "main thread";
    return {
        value: initialValue
    };
});
