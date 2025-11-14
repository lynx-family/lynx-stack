import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
var loadWorkletRuntime = __loadWorkletRuntime;
let X = {
    _c: {
        y1,
        y2,
        z1,
        z2
    },
    _wkltId: "a77b:test:1"
};
loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "a77b:test:1", function() {
    const X = lynxWorkletImpl._workletMap["a77b:test:1"].bind(this);
    let { __y1 = y1, __y2 = y2, __z1 = z1, __z2 = z2 } = this["_c"];
    {
        let y1 = __y1;
        let y2 = __y2;
        let z1 = __z1;
        let z2 = __z2;
        "main thread";
        console.log(y1[y2 + 1]);
        function Y() {
            "main thread";
            console.log(y1[y2 + 1]);
            console.log(z1[z2 + 1]);
        }
    }
});
