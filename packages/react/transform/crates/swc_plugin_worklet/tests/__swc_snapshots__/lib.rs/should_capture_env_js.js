import { captureMainThreadObject as __captureMainThreadObject } from "@lynx-js/react";
var captureMainThreadObject = __captureMainThreadObject;
let Y = {
    _c: {
        y1,
        y2,
        y3,
        y4,
        y5: captureMainThreadObject(y5) ?? {
            r: y5.r
        },
        props: captureMainThreadObject(props) ?? {
            value: ((__mainThreadObjectSource)=>captureMainThreadObject(__mainThreadObjectSource) ?? {
                    get: __mainThreadObjectSource.get
                })(props.value)
        }
    },
    _wkltId: "a77b:test:1"
};
