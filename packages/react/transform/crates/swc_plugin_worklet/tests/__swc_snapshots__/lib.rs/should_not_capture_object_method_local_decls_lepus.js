import "@lynx-js/react/worklet-runtime/init";
const valueType = defineMainThreadObjectType({
    type: '@test/value',
    create: {
        _wkltId: "a77b:test:1"
    }
});
registerWorkletInternal("main-thread", "a77b:test:1", function(initialValue) {
    "main thread";
    const state = {
        value: initialValue
    };
    return state;
});
