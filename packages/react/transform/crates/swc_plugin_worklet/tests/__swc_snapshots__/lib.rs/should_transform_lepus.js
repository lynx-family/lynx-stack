import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
var loadWorkletRuntime = __loadWorkletRuntime;
let X = {
    _c: {
        y1,
        y2,
        y3,
        y4,
        y8,
        y5,
        y6: {
            m: y6.m
        },
        y7
    },
    _wkltId: "a77b:test:1"
};
loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "a77b:test:1", function(event) {
    const X = lynxWorkletImpl._workletMap["a77b:test:1"].bind(this);
    let { y1, y2, y3, y4, y8, y5, y6, y7 } = this["_c"];
    "main thread";
    console.log(y1[y2 + 1]);
    if (({
        x: 345
    }).x.value) {
        console.log(y3);
    }
    let a = y4;
    const { b, c = y8 } = y5;
    a, b, c;
    y6.m = y7;
    function xxx() {}
});
