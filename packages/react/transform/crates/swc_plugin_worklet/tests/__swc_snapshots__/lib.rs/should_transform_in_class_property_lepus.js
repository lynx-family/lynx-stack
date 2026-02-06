import { loadWorkletRuntime as __loadWorkletRuntime, workletCapture as __workletCapture } from "@lynx-js/react";
var loadWorkletRuntime = __loadWorkletRuntime, workletCapture = __workletCapture;
let a = 1;
class App extends Component {
    onTapLepus = {
        _c: {
            a
        },
        _wkltId: "a77b:test:1",
        ...{
            a: this.a
        }
    };
}
loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "a77b:test:1", function(event) {
    let { a } = this["_c"];
    "main thread";
    console.log(a);
    console.log(this.a);
});
