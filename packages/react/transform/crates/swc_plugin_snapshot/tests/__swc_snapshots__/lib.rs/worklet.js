import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
const __snapshot_da39a_test_1 = "__snapshot_da39a_test_1";
require('@lynx-js/react/internal').snapshotCreatorMap[__snapshot_da39a_test_1] = (__snapshot_da39a_test_1)=>require('@lynx-js/react/internal').createSnapshot(__snapshot_da39a_test_1, function() {
        const pageId = require('@lynx-js/react/internal').__pageId;
        const el = __CreateView(pageId);
        const el1 = __CreateText(pageId);
        __AppendElement(el, el1);
        const el2 = __CreateRawText("1");
        __AppendElement(el1, el2);
        const el3 = __CreateText(pageId);
        __AppendElement(el, el3);
        const el4 = __CreateRawText("1");
        __AppendElement(el3, el4);
        return [
            el,
            el1,
            el2,
            el3,
            el4
        ];
    }, [
        (snapshot, index, oldValue)=>require('@lynx-js/react/internal').updateWorkletEvent(snapshot, index, oldValue, 1, "main-thread", "bindEvent", "tap"),
        (snapshot, index, oldValue)=>require('@lynx-js/react/internal').updateWorkletRef(snapshot, index, oldValue, 3, "main-thread")
    ], null, undefined, globDynamicComponentEntry, null);
function Comp() {
    const handleTap = ()=>{};
    const handleRef = ()=>{};
    return _jsx(__snapshot_da39a_test_1, {
        values: [
            handleTap,
            handleRef
        ]
    });
}
