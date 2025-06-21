import * as ReactLynx from "@lynx-js/react";
import { SimpleStyleSheet } from '@lynx-js/react';
const styles = {
    dynamic: (color, size)=>({
            8: color,
            35: size
        })
};
const __snapshot_da39a_test_1 = ReactLynx.createSnapshot("__snapshot_da39a_test_1", function(snapshotInstance) {
    const pageId = ReactLynx.__pageId;
    const el = __CreateView(pageId);
    __SetClasses(el, "root");
    const el1 = __CreateView(pageId);
    __AppendElement(el, el1);
    const el2 = __CreateView(pageId);
    __AppendElement(el, el2);
    return [
        el,
        el1,
        el2
    ];
}, [
    (snapshot, index, oldValue)=>ReactLynx.updateEvent(snapshot, index, oldValue, 0, "bindEvent", "tap", ''),
    function(ctx) {
        if (ctx.__elements) {
            __SetStyleObject(ctx.__elements[1], ctx.__values[1]);
        }
    },
    function(ctx) {
        if (ctx.__elements) {
            __SetStyleObject(ctx.__elements[2], ctx.__values[2]);
        }
    }
], null, undefined, globDynamicComponentEntry, null);
function ComponentWithSimpleStyle({ dynamicStyleArgs }) {
    __SimpleStyleInject("bad68fd", "border-left-width", "1px");
    __SimpleStyleInject("f61f6f2", "border-left-style", "solid");
    return <__snapshot_da39a_test_1 values={[
        1,
        [
            "bad68fd",
            "f61f6f2",
            styles.dynamic(...dynamicStyleArgs)
        ],
        [
            "bad68fd",
            "f61f6f2",
            styles.dynamic(...dynamicStyleArgs)
        ]
    ]}/>;
}
