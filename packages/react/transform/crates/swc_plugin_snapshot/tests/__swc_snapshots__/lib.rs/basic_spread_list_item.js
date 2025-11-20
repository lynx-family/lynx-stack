import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
import * as ReactLynx from "@lynx-js/react";
const __snapshot_da39a_test_1 = "__snapshot_da39a_test_1";
ReactLynx.snapshotCreatorMap[__snapshot_da39a_test_1] = (__snapshot_da39a_test_1)=>ReactLynx.createSnapshot(__snapshot_da39a_test_1, function(snapshotInstance) {
        const pageId = ReactLynx.__pageId;
        const el = ReactLynx.snapshotCreateList(pageId, snapshotInstance, 0);
        const el1 = __CreateElement("list-item", pageId);
        __AppendElement(el, el1);
        const el2 = __CreateRawText("!!!");
        __AppendElement(el1, el2);
        return [
            el,
            el1,
            el2
        ];
    }, [
        (snapshot, index, oldValue)=>ReactLynx.updateSpread(snapshot, index, oldValue, 1, true)
    ], null, undefined, globDynamicComponentEntry, [
        0
    ], true);
_jsx(__snapshot_da39a_test_1, {
    values: [
        {
            "item-key": "world",
            ...obj,
            __spread: true
        }
    ]
});
