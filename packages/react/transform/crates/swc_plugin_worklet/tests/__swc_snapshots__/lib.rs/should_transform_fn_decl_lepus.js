import "@lynx-js/react/worklet-runtime/init?owner=a123-test";
export default {
    _c: {
        x
    },
    _wkltId: "a123:test:1"
};
registerWorkletInternal("main-thread", "a123:test:1", function(exposureArgs) {
    let { x } = this["_c"];
    'main thread';
    console.log('useExposure2');
    console.log(exposureArgs);
    x;
});
