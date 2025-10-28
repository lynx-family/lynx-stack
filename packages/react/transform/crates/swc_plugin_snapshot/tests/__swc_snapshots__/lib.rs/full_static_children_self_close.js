import * as ReactLynx from "@lynx-js/react";
const __snapshot_da39a_test_1 = "__snapshot_da39a_test_1";
ReactLynx.snapshotCreatorMap[__snapshot_da39a_test_1] = ()=>ReactLynx.createSnapshot(__snapshot_da39a_test_1, function() {
        const pageId = ReactLynx.__pageId;
        const el = __CreateView(pageId);
        __SetClasses(el, "parent");
        const el1 = __CreateView(pageId);
        __SetClasses(el1, "child");
        __AppendElement(el, el1);
        const el2 = __CreateView(pageId);
        __SetClasses(el2, "child");
        __AppendElement(el, el2);
        return [
            el,
            el1,
            el2
        ];
    }, null, null, undefined, globDynamicComponentEntry, null);
<__snapshot_da39a_test_1/>;
