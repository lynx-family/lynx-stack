import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
var loadWorkletRuntime = __loadWorkletRuntime;
let Y = {
    _c: {
        y1,
        y2,
        y3,
        y4,
        y5: {
            r: y5.r
        }
    },
    _wkltId: "a77b:test:1"
};
loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "a77b:test:1", function() {
    const Y = lynxWorkletImpl._workletMap["a77b:test:1"].bind(this);
    let { y1, y2, y3, y4, y5 } = this["_c"];
    "main thread";
    let a = 123;
    const b = [
        a,
        ...y1
    ];
    const c = {
        a,
        y2,
        ...y3,
        ...{
            d: 233,
            e: y4
        }
    };
    return y5.r;
});
