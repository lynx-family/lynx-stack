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
    let { __y1 = y1, __y2 = y2, __y3 = y3, __y4 = y4, __y8 = y8, __y5 = y5, __y6 = y6, __y7 = y7 } = this["_c"];
    {
        let y1 = __y1;
        let y2 = __y2;
        let y3 = __y3;
        let y4 = __y4;
        let y8 = __y8;
        let y5 = __y5;
        let y6 = __y6;
        let y7 = __y7;
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
    }
});
