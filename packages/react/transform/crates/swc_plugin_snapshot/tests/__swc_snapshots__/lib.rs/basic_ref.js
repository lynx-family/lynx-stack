import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
import * as ReactLynx from "@lynx-js/react";
const __snapshot_da39a_test_1 = "__snapshot_da39a_test_1";
ReactLynx.snapshotCreatorMap[__snapshot_da39a_test_1] = (__snapshot_da39a_test_1, __runtime__)=>__runtime__.createSnapshot(__snapshot_da39a_test_1, function() {
        const pageId = __runtime__.__pageId;
        const el = __CreateView(pageId);
        const el1 = __CreateText(pageId);
        __AppendElement(el, el1);
        const el2 = __CreateRawText("1");
        __AppendElement(el1, el2);
        const el3 = __CreateText(pageId);
        __AppendElement(el, el3);
        const el4 = __CreateRawText("2");
        __AppendElement(el3, el4);
        const el5 = __CreateText(pageId);
        __AppendElement(el, el5);
        const el6 = __CreateRawText("3");
        __AppendElement(el5, el6);
        return [
            el,
            el1,
            el2,
            el3,
            el4,
            el5,
            el6
        ];
    }, [
        (snapshot, index, oldValue)=>__runtime__.updateRef(snapshot, index, oldValue, 1),
        (snapshot, index, oldValue)=>__runtime__.updateEvent(snapshot, index, oldValue, 3, "bindEvent", "tap", ''),
        (snapshot, index, oldValue)=>__runtime__.updateRef(snapshot, index, oldValue, 5)
    ], null, undefined, globDynamicComponentEntry, [
        0,
        2
    ], true);
function Comp() {
    const handleRef = ()=>{};
    return _jsx(__snapshot_da39a_test_1, {
        values: [
            ReactLynx.transformRef(handleRef),
            handleRef,
            ReactLynx.transformRef(handleRef)
        ]
    });
}
