import { transformToWorklet as __transformToWorklet } from "@lynx-js/react";
var transformToWorklet = __transformToWorklet;
const callback = ()=>{};
const valueType = defineMainThreadObjectType({
    type: '@test/capturing-value',
    helper: 1,
    get create () {
        return {
            _wkltId: "a77b:test:1",
            _jsFn: {
                _jsFn1: transformToWorklet(callback)
            },
            ...{
                helper: this.helper
            }
        };
    }
});
