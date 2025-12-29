import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
var loadWorkletRuntime = __loadWorkletRuntime;
let onTapLepus = {
    _wkltId: "a123:test:1",
    _jsFn: {
        _jsFn1: {
            _isFirstScreen: true
        },
        _jsFn2: {
            _isFirstScreen: true
        },
        _jsFn3: {
            _isFirstScreen: true
        }
    }
};
loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "a123:test:1", function(event: ReactLynx.Worklet.ITouchEvent) {
    const onTapLepus = lynxWorkletImpl._workletMap["a123:test:1"].bind(this);
    let { _jsFn1, _jsFn2, _jsFn3 } = this["_jsFn"];
    "main thread";
    runOnBackground(_jsFn1);
    runOnBackground(_jsFn2);
    runOnBackground(_jsFn3);
});
