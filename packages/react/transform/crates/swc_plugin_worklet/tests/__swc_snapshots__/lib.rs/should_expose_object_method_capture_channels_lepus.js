import "@lynx-js/react/worklet-runtime/init";
const callback = ()=>{};
const valueType = defineMainThreadObjectType({
    type: '@test/capturing-value',
    helper: 1,
    callback,
    get callbackOnly () {
        return {
            _wkltId: "a77b:test:1",
            _jsFn: {
                _jsFn1: {
                    _isFirstScreen: true
                }
            }
        };
    },
    get create () {
        return {
            _wkltId: "a77b:test:2",
            _jsFn: {
                _jsFn1: {
                    _isFirstScreen: true
                }
            },
            ...{
                helper: this.helper
            }
        };
    }
});
registerWorkletInternal("main-thread", "a77b:test:1", function() {
    let { _jsFn1 } = this["_jsFn"];
    "main thread";
    runOnBackground(_jsFn1)();
});
registerWorkletInternal("main-thread", "a77b:test:2", function(initialValue: number) {
    let { _jsFn1 } = this["_jsFn"];
    "main thread";
    runOnBackground(_jsFn1)();
    return {
        value: initialValue + this.helper
    };
});
