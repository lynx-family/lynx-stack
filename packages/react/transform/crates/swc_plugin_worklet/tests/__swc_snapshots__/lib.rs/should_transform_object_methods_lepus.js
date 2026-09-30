import "@lynx-js/react/worklet-runtime/init";
import { create } from './shared.js' with {
    runtime: "shared"
};
const valueType = defineMainThreadObjectType({
    type: '@test/value',
    create: {
        _wkltId: "a77b:test:1"
    }
});
registerWorkletInternal("main-thread", "a77b:test:1", function(initialValue: number) {
    "main thread";
    return create(initialValue);
});
