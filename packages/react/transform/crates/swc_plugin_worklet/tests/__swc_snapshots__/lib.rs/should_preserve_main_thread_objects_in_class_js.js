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
                value: ((__mainThreadObjectSource)=>captureMainThreadObject(__mainThreadObjectSource) ?? {
                        "get": __mainThreadObjectSource["get"],
                        set: __mainThreadObjectSource.set
                    })(this.value),
                props: ((__mainThreadObjectSource)=>captureMainThreadObject(__mainThreadObjectSource) ?? {
                        value: ((__mainThreadObjectSource)=>captureMainThreadObject(__mainThreadObjectSource) ?? {
                                get: __mainThreadObjectSource.get
                            })(__mainThreadObjectSource.value)
                    })(this.props),
                ref: this.ref
            }
        };
    }
    get onMove() {
        return {
            _wkltId: "a123:test:2",
            ...{
                value: ((__mainThreadObjectSource)=>captureMainThreadObject(__mainThreadObjectSource) ?? {
                        get: __mainThreadObjectSource.get
                    })(this.value)
            }
        };
    }
    static onStatic = {
        _wkltId: "a123:test:3",
        ...{
            value: ((__mainThreadObjectSource)=>captureMainThreadObject(__mainThreadObjectSource) ?? {
                    get: __mainThreadObjectSource.get
                })(this.value)
        }
    };
}
