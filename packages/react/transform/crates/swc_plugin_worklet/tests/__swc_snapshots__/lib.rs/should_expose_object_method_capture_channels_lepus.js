import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
var loadWorkletRuntime = __loadWorkletRuntime;
const callback = ()=>{};
const valueType = defineMainThreadObjectType({
    type: '@test/capturing-value',
    helper: 1,
    get create () {
        return {
            _wkltId: "a77b:test:1",
            _jsFn: {
                _jsFn1: {
                    _isFirstScreen: true
                }
            },
            ...{
                helper: this.helper
            }
        };
    }
});
const __workletRuntimeLoaded = loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry);
__workletRuntimeLoaded && registerWorkletInternal("main-thread", "a77b:test:1", function(initialValue: number) {
    let { _jsFn1 } = this["_jsFn"];
    "main thread";
    runOnBackground(_jsFn1)();
    return {
        value: initialValue + this.helper
    };
});
