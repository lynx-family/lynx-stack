import "@lynx-js/react/worklet-runtime/init";
let Y = {
    _wkltId: "a77b:test:1"
};
registerWorkletInternal("main-thread", "a77b:test:1", function() {
    const Y = lynxWorkletImpl._workletMap["a77b:test:1"].bind(this);
    "main thread";
    console.log(111);
    setTimeout(()=>{});
    lynx.querySelector();
    SystemInfo.version;
    myCustomGlobal;
});
