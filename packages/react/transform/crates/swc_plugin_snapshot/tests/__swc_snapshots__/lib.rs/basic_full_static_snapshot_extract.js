import * as ReactLynx from "@lynx-js/react";
ReactLynx.snapshotCreatorMap["snapshot_da39a_test_1"] = ()=>ReactLynx.createSnapshot("snapshot_da39a_test_1", function() {
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
    }, null, null, undefined, globDynamicComponentEntry, null);
let s = __SNAPSHOT__(<snapshot_da39a_test_1/>);
