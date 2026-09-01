import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
var loadWorkletRuntime = __loadWorkletRuntime;
import { create } from './shared.js' with {
    runtime: "shared"
};
const valueType = defineMainThreadObjectType({
    type: '@test/value',
    create: {
        _wkltId: "a77b:test:1"
    }
});
const __workletRuntimeLoaded = loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry);
__workletRuntimeLoaded && registerWorkletInternal("main-thread", "a77b:test:1", function(initialValue: number) {
    "main thread";
    return create(initialValue);
});
