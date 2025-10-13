import * as ReactLynx from "@lynx-js/react";
ReactLynx.snapshotCreatorMap["snapshot_da39a_test_3"] = ()=>ReactLynx.createSnapshot("snapshot_da39a_test_3", function() {
        const pageId = ReactLynx.__pageId;
        const el = __CreateElement("list-item", pageId);
        return [
            el
        ];
    }, [
        (snapshot, index, oldValue)=>ReactLynx.updateListItemPlatformInfo(snapshot, index, oldValue, 0)
    ], null, undefined, globDynamicComponentEntry, null);
ReactLynx.snapshotCreatorMap["snapshot_da39a_test_2"] = ()=>ReactLynx.createSnapshot("snapshot_da39a_test_2", function(snapshotInstance) {
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
ReactLynx.snapshotCreatorMap["snapshot_da39a_test_4"] = ()=>ReactLynx.createSnapshot("snapshot_da39a_test_4", function() {
        const pageId = ReactLynx.__pageId;
        const el = __CreateView(pageId);
        return [
            el
        ];
    }, null, ReactLynx.__DynamicPartChildren_0, undefined, globDynamicComponentEntry, null);
ReactLynx.snapshotCreatorMap["snapshot_da39a_test_1"] = ()=>ReactLynx.createSnapshot("snapshot_da39a_test_1", function() {
        const pageId = ReactLynx.__pageId;
        const el = __CreateView(pageId);
        const el1 = __CreateWrapperElement(pageId);
        __AppendElement(el, el1);
        const el2 = __CreateWrapperElement(pageId);
        __AppendElement(el, el2);
        return [
            el,
            el1,
            el2
        ];
    }, null, [
        [
            ReactLynx.__DynamicPartSlot,
            1
        ],
        [
            ReactLynx.__DynamicPartSlot,
            2
        ]
    ], undefined, globDynamicComponentEntry, null);
<snapshot_da39a_test_1><snapshot_da39a_test_2><snapshot_da39a_test_3 values={[
    {
        "full-span": true,
        "reuse-identifier": x
    }
]}/></snapshot_da39a_test_2><snapshot_da39a_test_4><A/></snapshot_da39a_test_4></snapshot_da39a_test_1>;
