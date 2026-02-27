import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
const __snapshot_da39a_test_1 = "__snapshot_da39a_test_1";
require('@lynx-js/react/internal').snapshotCreatorMap[__snapshot_da39a_test_1] = (__snapshot_da39a_test_1)=>require('@lynx-js/react/internal').createSnapshot(__snapshot_da39a_test_1, function() {
        const pageId = require('@lynx-js/react/internal').__pageId;
        const el = __CreateView(pageId);
        const el1 = __CreateText(pageId);
        __AppendElement(el, el1);
        const el2 = __CreateRawText("1");
        __AppendElement(el1, el2);
        return [
            el,
            el1,
            el2
        ];
    }, [
        (snapshot, index, oldValue)=>require('@lynx-js/react/internal').updateGesture(snapshot, index, oldValue, 1, "main-thread")
    ], null, undefined, globDynamicComponentEntry, null, true);
function Comp() {
    const gesture = {};
    return _jsx(__snapshot_da39a_test_1, {
        values: [
            gesture
        ]
    });
}
