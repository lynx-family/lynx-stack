import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
var loadWorkletRuntime = __loadWorkletRuntime;
let onTapLepus = {
    _c: {
        wv
    },
    _wkltId: "a77b:test:1"
};
loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "a77b:test:1", function(event: ReactLynx.Worklet.ITouchEvent) {
    const onTapLepus = lynxWorkletImpl._workletMap["a77b:test:1"].bind(this);
    let { wv } = this["_c"];
    "main thread";
    type XXXX = YYYY;
    class N {
    }
    ;
    let a: AClass = 0;
    console.log(a);
    event.target.setStyle("background-color", wv.current % 2 ? "blue" : "green");
    event.target.setStyle("height", "200px");
});
