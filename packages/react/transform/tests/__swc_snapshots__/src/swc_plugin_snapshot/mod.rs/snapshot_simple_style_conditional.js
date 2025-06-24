import * as ReactLynx from "@lynx-js/react";
import { SimpleStyleSheet } from '@lynx-js/react';
const styles = SimpleStyleSheet.create({
    conditional1: {
        borderBottomWidth: '1px',
        borderBottomColor: 'red',
        borderBottomStyle: 'solid'
    },
    conditional2: {
        borderTopWidth: '1px',
        borderTopColor: 'red',
        borderTopStyle: 'solid'
    }
});
const __snapshot_da39a_test_1 = ReactLynx.createSnapshot("__snapshot_da39a_test_1", function(snapshotInstance) {
    const pageId = ReactLynx.__pageId;
    const el = __CreateView(pageId);
    __SetClasses(el, "root");
    const el1 = __CreateView(pageId);
    __DefineSimpleStyle({
        snapshotInstance: snapshotInstance,
        element: el1,
        elementIndex: 1,
        staticStyles: [],
        dynamicStyles: [
            condition1 && styles.conditional1,
            condition2 && styles.conditional2
        ]
    });
    __AppendElement(el, el1);
    const el2 = __CreateView(pageId);
    __DefineSimpleStyle({
        snapshotInstance: snapshotInstance,
        element: el2,
        elementIndex: 2,
        staticStyles: [],
        dynamicStyles: [
            condition1 && styles.conditional1,
            condition2 && styles.conditional2
        ]
    });
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
function ComponentWithSimpleStyle({ condition1, condition2 }) {
    return <__snapshot_da39a_test_1 values={[
        1,
        __ConsumeSimpleStyle({
            staticStyles: [],
            dynamicStyles: [
                condition1 && styles.conditional1,
                condition2 && styles.conditional2
            ]
        }),
        __ConsumeSimpleStyle({
            staticStyles: [],
            dynamicStyles: [
                condition1 && styles.conditional1,
                condition2 && styles.conditional2
            ]
        })
    ]}/>;
}
