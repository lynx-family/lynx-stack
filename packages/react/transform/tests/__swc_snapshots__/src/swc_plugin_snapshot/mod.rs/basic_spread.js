import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
import * as ReactLynx from "@lynx-js/react";
const __snapshot_da39a_test_1 = ReactLynx.createSnapshot("__snapshot_da39a_test_1", function() {
    const pageId = ReactLynx.__pageId;
    const el = __CreateView(pageId);
    const el1 = __CreateText(pageId);
    __AppendElement(el, el1);
    const el2 = __CreateRawText("!!!");
    __AppendElement(el1, el2);
    return [
        el,
        el1,
        el2
    ];
}, [
    (snapshot, index, oldValue)=>ReactLynx.updateSpread(snapshot, index, oldValue, 1)
], null, undefined, globDynamicComponentEntry);
_jsx(__snapshot_da39a_test_1, {
    values: [
        {
            "before": "bbb",
            ...obj,
            "after": "aaa",
            __spread: true
        }
    ]
});
