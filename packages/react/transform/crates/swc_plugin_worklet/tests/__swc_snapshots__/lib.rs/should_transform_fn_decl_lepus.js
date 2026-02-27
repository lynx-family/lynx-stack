import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
var loadWorkletRuntime = __loadWorkletRuntime;
export default {
    _c: {
        x
    },
    _wkltId: "a123:test:1"
};
loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "a123:test:1", function(exposureArgs) {
    let { x } = this["_c"];
    'main thread';
    console.log('useExposure2');
    console.log(exposureArgs);
    x;
});
