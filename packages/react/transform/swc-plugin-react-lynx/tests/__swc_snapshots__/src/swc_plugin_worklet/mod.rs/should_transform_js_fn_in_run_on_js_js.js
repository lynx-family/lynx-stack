import { transformToWorklet as __transformToWorklet } from "@lynx-js/react";
var transformToWorklet = __transformToWorklet;
let onTapLepus = {
    _wkltId: "a123:test:1",
    _jsFn: {
        _jsFn1: transformToWorklet(fn1),
        _jsFn2: transformToWorklet(obj.fn2),
        _jsFn3: transformToWorklet(obj[fn3])
    }
};
