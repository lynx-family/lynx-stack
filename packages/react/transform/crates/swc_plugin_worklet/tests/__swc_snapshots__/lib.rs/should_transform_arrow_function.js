import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
var loadWorkletRuntime = __loadWorkletRuntime;
let X = {
    _c: {
        y1,
        y2
    },
    _wkltId: "a77b:test:1"
};
loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "a77b:test:1", function(event) {
    let { __y1 = y1, __y2 = y2 } = this["_c"];
    {
        let y1 = __y1;
        let y2 = __y2;
        "main thread";
        console.log(y1[y2 + 1]);
    }
});
