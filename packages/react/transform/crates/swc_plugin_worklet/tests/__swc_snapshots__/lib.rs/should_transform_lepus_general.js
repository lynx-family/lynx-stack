import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
var loadWorkletRuntime = __loadWorkletRuntime;
let worklet = {
    _c: {
        y1
    },
    _wkltId: "a77b:test:1"
};
loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "a77b:test:1", function(event: Event) {
    const worklet = lynxWorkletImpl._workletMap["a77b:test:1"].bind(this);
    let { __y1 = y1 } = this["_c"];
    {
        let y1 = __y1;
        "main thread";
        console.log(y1);
        console.log(this.y1);
        let a: object = y1;
    }
});
