import { loadWorkletRuntime as __loadWorkletRuntime, workletCapture as __workletCapture } from "@lynx-js/react";
var loadWorkletRuntime = __loadWorkletRuntime, workletCapture = __workletCapture;
class App extends Component {
    a = 1;
    onTapLepus = {
        _wkltId: "a77b:test:1",
        ...{
            a: this.a
        }
    };
}
loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "a77b:test:1", function(event) {
    this["onTapLepus"] = lynxWorkletImpl._workletMap["a77b:test:1"].bind(this);
    "main thread";
    console.log(this.a);
});
