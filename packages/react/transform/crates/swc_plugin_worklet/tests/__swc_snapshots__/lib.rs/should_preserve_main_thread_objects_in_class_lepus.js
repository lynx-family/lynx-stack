import { captureMainThreadObject as __captureMainThreadObject, loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
var captureMainThreadObject = __captureMainThreadObject, loadWorkletRuntime = __loadWorkletRuntime;
class App extends Component {
    value: MotionValue<number>;
    ref: MainThreadRef<number>;
    static value: MotionValue<number>;
    onTap = {
        _wkltId: "a123:test:1",
        ...{
            value: captureMainThreadObject(this.value) ?? {
                "get": this.value["get"],
                set: this.value.set
            },
            ref: this.ref
        }
    };
    onMove = {
        _wkltId: "a123:test:2",
        ...{
            value: captureMainThreadObject(this.value) ?? {
                get: this.value.get
            }
        }
    };
    static onStatic = {
        _wkltId: "a123:test:3",
        ...{
            value: captureMainThreadObject(this.value) ?? {
                get: this.value.get
            }
        }
    };
}
const __workletRuntimeLoaded = loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry);
__workletRuntimeLoaded && registerWorkletInternal("main-thread", "a123:test:1", function() {
    this["onTap"] = lynxWorkletImpl._workletMap["a123:test:1"].bind(this);
    "main thread";
    this.value.get();
    this.value.set(1);
    this.value?.get();
    this.value["get"]();
    return this.ref.current;
});
__workletRuntimeLoaded && registerWorkletInternal("main-thread", "a123:test:2", function() {
    "main thread";
    return this.value.get();
});
__workletRuntimeLoaded && registerWorkletInternal("main-thread", "a123:test:3", function() {
    this["onStatic"] = lynxWorkletImpl._workletMap["a123:test:3"].bind(this);
    "main thread";
    return this.value.get();
});
