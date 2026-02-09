import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
var loadWorkletRuntime = __loadWorkletRuntime;
import { sharedRuntime } from './utils.js' with {
    runtime: "shared"
};
let worklet = {
    _c: {
        y1
    },
    _wkltId: "a77b:test:1",
    ...{
        y1: this.y1
    }
};
loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "a77b:test:1", function(event: Event) {
    const worklet = lynxWorkletImpl._workletMap["a77b:test:1"].bind(this);
    let { y1 } = this["_c"];
    "main thread";
    console.log(sharedRuntime);
    console.log(this.y1);
    let a: object = y1;
});
