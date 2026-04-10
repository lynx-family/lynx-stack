import "@lynx-js/react/worklet-runtime/init";
const __workletRuntimeLoaded = false;
console.log(__workletRuntimeLoaded);
let foo = {
    _wkltId: "a123:test:1"
};
registerWorkletInternal("main-thread", "a123:test:1", function() {
    const foo = lynxWorkletImpl._workletMap["a123:test:1"].bind(this);
    "main thread";
    return 1;
});
