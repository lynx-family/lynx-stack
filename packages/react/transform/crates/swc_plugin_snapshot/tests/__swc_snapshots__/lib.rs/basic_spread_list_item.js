import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
import * as ReactLynx from "@lynx-js/react";
const __snapshot_da39a_test_2 = ReactLynx.createSnapshot("__snapshot_da39a_test_2", function() {
    const pageId = ReactLynx.__pageId;
    const el = __CreateElement("list-item", pageId);
    const el1 = __CreateRawText("!!!");
    __AppendElement(el, el1);
    return [
        el,
        el1
    ];
}, [
    (snapshot, index, oldValue)=>ReactLynx.updateSpread(snapshot, index, oldValue, 0, true)
], null, undefined, globDynamicComponentEntry, [
    0
]);
const __snapshot_da39a_test_1 = ReactLynx.createSnapshot("__snapshot_da39a_test_1", function(snapshotInstance) {
    const pageId = ReactLynx.__pageId;
    const el = ReactLynx.snapshotCreateList(pageId, snapshotInstance, 0);
    return [
        el
    ];
}, null, [
    [
        ReactLynx.__DynamicPartListChildren,
        0
    ]
], undefined, globDynamicComponentEntry, null);
_jsx(__snapshot_da39a_test_1, {
    children: _jsx(__snapshot_da39a_test_2, {
        values: [
            {
                "item-key": "world",
                ...obj,
                __spread: true
            }
        ]
    }, "hello")
});
