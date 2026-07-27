import './spin.js';
import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
var loadWorkletRuntime = __loadWorkletRuntime;
import type { Spin } from './spin-types.js';
import { type Deg, spin } from './spin.js';
let worklet = {
    _c: {
        spin
    },
    _wkltId: "a77b:test:1"
};
const __workletRuntimeLoaded = loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry);
__workletRuntimeLoaded && registerWorkletInternal("main-thread", "a77b:test:1", function(event: Event) {
    const worklet = lynxWorkletImpl._workletMap["a77b:test:1"].bind(this);
    let { spin } = this["_c"];
    "main thread";
    let s: Spin = spin;
    let d: Deg = 45;
    spin(event.currentTarget, d);
});
