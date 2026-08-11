import './spin.js';
import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
var loadWorkletRuntime = __loadWorkletRuntime;
import { spin } from './spin.js';
let worklet = {
    _c: {
        spin
    },
    _wkltId: "a77b:test:1"
};
const __workletRuntimeLoaded = loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry);
__workletRuntimeLoaded && registerWorkletInternal("main-thread", "a77b:test:1", function(event) {
    const worklet = lynxWorkletImpl._workletMap["a77b:test:1"].bind(this);
    let { spin } = this["_c"];
    "main thread";
    spin(event.currentTarget, 45);
});
