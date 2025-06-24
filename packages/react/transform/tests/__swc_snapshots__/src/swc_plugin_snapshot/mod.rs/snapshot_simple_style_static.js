import * as ReactLynx from "@lynx-js/react";
import { SimpleStyleSheet } from '@lynx-js/react';
const styles = SimpleStyleSheet.create({
    static1: {
        width: '100px',
        height: '100px'
    },
    static2: {
        backgroundColor: 'blue',
        color: 'green'
    },
    static3: {
        textAlign: 'center',
        display: 'flex'
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
        staticStyles: [
            styles.static1,
            styles['static2'],
            styles.static3
        ],
        dynamicStyles: []
    });
    __AppendElement(el, el1);
    const el2 = __CreateView(pageId);
    __DefineSimpleStyle({
        snapshotInstance: snapshotInstance,
        element: el2,
        elementIndex: 2,
        staticStyles: [
            styles.static1,
            styles['static2'],
            styles.static3
        ],
        dynamicStyles: []
    });
    __AppendElement(el, el2);
    return [
        el,
        el1,
        el2
    ];
}, [
    (snapshot, index, oldValue)=>ReactLynx.updateEvent(snapshot, index, oldValue, 0, "bindEvent", "tap", '')
], null, undefined, globDynamicComponentEntry, null);
function ComponentWithSimpleStyle() {
    return <__snapshot_da39a_test_1 values={[
        1
    ]}/>;
}
