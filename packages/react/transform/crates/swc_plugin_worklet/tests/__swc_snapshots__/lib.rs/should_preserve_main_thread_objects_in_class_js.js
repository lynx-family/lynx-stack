import { captureMainThreadObject as __captureMainThreadObject } from "@lynx-js/react";
var captureMainThreadObject = __captureMainThreadObject;
class App extends Component {
    value: MotionValue<number>;
    ref: MainThreadRef<number>;
    static value: MotionValue<number>;
    get onTap() {
        return {
            _wkltId: "a123:test:1",
            ...{
                value: captureMainThreadObject(this.value) ?? {
                    "get": this.value["get"],
                    set: this.value.set
                },
                ref: this.ref
            }
        };
    }
    get onMove() {
        return {
            _wkltId: "a123:test:2",
            ...{
                value: captureMainThreadObject(this.value) ?? {
                    get: this.value.get
                }
            }
        };
    }
    static onStatic = {
        _wkltId: "a123:test:3",
        ...{
            value: captureMainThreadObject(this.value) ?? {
                get: this.value.get
            }
        }
    };
}
