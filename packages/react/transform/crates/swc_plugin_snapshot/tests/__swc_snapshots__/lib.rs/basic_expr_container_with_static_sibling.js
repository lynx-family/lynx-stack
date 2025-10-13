import * as ReactLynx from "@lynx-js/react";
ReactLynx.snapshotCreatorMap["snapshot_da39a_test_1"] = ()=>ReactLynx.createSnapshot("snapshot_da39a_test_1", function() {
        const pageId = ReactLynx.__pageId;
        const el = __CreateView(pageId);
        const el1 = __CreateText(pageId);
        __AppendElement(el, el1);
        const el2 = __CreateRawText("!!!");
        __AppendElement(el1, el2);
        const el3 = __CreateWrapperElement(pageId);
        __AppendElement(el, el3);
        return [
            el,
            el1,
            el2,
            el3
        ];
    }, null, [
        [
            ReactLynx.__DynamicPartChildren,
            3
        ]
    ], undefined, globDynamicComponentEntry, null);
<snapshot_da39a_test_1>{a}</snapshot_da39a_test_1>;
