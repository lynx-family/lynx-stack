import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
import * as ReactLynx from "@lynx-js/react";
const __snapshot_da39a_test_1 = "__snapshot_da39a_test_1";
ReactLynx.snapshotCreatorMap[__snapshot_da39a_test_1] = (__snapshot_da39a_test_1, __runtime__)=>(__runtime__ || require("@lynx-js/react")).createSnapshot(__snapshot_da39a_test_1, function() {
        const pageId = (__runtime__ || require("@lynx-js/react")).__pageId;
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
        (snapshot, index, oldValue)=>(__runtime__ || require("@lynx-js/react")).updateEvent(snapshot, index, oldValue, 1, "bindEvent", "tap", '')
    ], null, undefined, globDynamicComponentEntry, null, true);
function Comp() {
    const handleTap = ()=>{};
    return _jsx(__snapshot_da39a_test_1, {
        values: [
            handleTap
        ]
    });
}
