import './config.json' with {
    type: 'json'
};
import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
var loadWorkletRuntime = __loadWorkletRuntime;
import cfg from './config.json' with {
    type: 'json'
};
let worklet = {
    _c: {
        cfg: {
            color: cfg.color
        }
    },
    _wkltId: "a77b:test:1"
};
const __workletRuntimeLoaded = loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry);
__workletRuntimeLoaded && registerWorkletInternal("main-thread", "a77b:test:1", function(event) {
    const worklet = lynxWorkletImpl._workletMap["a77b:test:1"].bind(this);
    let { cfg } = this["_c"];
    "main thread";
    event.currentTarget.setStyleProperty('color', cfg.color);
});
