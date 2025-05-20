import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
var loadWorkletRuntime = __loadWorkletRuntime;
class App extends Component {
    a = 1;
    onTapLepus = {
        _wkltId: "a77b:test:1"
    };
}
loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "a77b:test:1", function(event) {
    this["onTapLepus"] = lynxWorkletImpl._workletMap["a77b:test:1"].bind(this);
    "main thread";
    console.log(this.a);
});
