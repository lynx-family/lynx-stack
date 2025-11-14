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
    let { __y1 = y1, __y2 = y2, __y3 = y3, __y4 = y4, __y5 = y5 } = this["_c"];
    {
        let y1 = __y1;
        let y2 = __y2;
        let y3 = __y3;
        let y4 = __y4;
        let y5 = __y5;
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
    }
});
