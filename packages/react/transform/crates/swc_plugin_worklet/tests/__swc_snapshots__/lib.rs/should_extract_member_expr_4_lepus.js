import "@lynx-js/react/worklet-runtime";
let enableScroll = {
    _wkltId: "a123:test:1"
};
registerWorkletInternal("main-thread", "a123:test:1", function(enable: boolean) {
    const enableScroll = lynxWorkletImpl._workletMap["a123:test:1"].bind(this);
    'main thread';
    function x() {
        this.a;
    }
});
