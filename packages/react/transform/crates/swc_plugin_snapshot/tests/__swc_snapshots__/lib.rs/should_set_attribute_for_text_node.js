import * as ReactLynx from "@lynx-js/react";
const __snapshot_da39a_test_1 = "__snapshot_da39a_test_1";
ReactLynx.snapshotCreatorMap[__snapshot_da39a_test_1] = (__snapshot_da39a_test_1)=>ReactLynx.createSnapshot(__snapshot_da39a_test_1, function() {
        const pageId = ReactLynx.__pageId;
        const el = __CreateView(pageId);
        const el1 = __CreateText(pageId);
        __SetAttribute(el1, "text", "Hello World 0");
        __AppendElement(el, el1);
        const el2 = __CreateText(pageId);
        __SetAttribute(el2, "text", " ");
        __AppendElement(el, el2);
        const el3 = __CreateText(pageId);
        __AppendElement(el, el3);
        const el4 = __CreateText(pageId);
        __SetClasses(el4, "hello");
        __SetAttribute(el4, "text", "Hello World 1");
        __AppendElement(el, el4);
        const el5 = __CreateText(pageId);
        __AppendElement(el, el5);
        const el6 = __CreateText(pageId);
        __SetAttribute(el6, "text", "Hello Lynx");
        __SetAttribute(el6, "text", "Hello World 3");
        __AppendElement(el, el6);
        return [
            el,
            el1,
            el2,
            el3,
            el4,
            el5,
            el6
        ];
    }, [
        (snapshot, index, oldValue)=>ReactLynx.updateSpread(snapshot, index, oldValue, 5)
    ], null, undefined, globDynamicComponentEntry, [
        0
    ], true);
<__snapshot_da39a_test_1 values={[
    {
        ...attrs,
        "text": "Hello World 2",
        __spread: true
    }
]}/>;
