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
    },
    conditional1: {
        borderBottomWidth: '1px',
        borderBottomColor: 'red',
        borderBottomStyle: 'solid'
    },
    conditional2: {
        borderTopWidth: '1px',
        borderTopColor: 'red',
        borderTopStyle: 'solid'
    },
    conditional3: {
        borderRightWidth: '1px',
        borderRightColor: 'red',
        borderRightStyle: 'solid'
    },
    conditional4: {
        borderRightWidth: '2px',
        borderRightColor: 'blue',
        borderRightStyle: 'dashed'
    },
    conditional5: {
        fontSize: '12px'
    },
    conditional6: {},
    dynamic: (color, size)=>({
            borderLeftColor: color,
            borderLeftWidth: '1px',
            borderLeftStyle: 'solid',
            paddingTop: size
        })
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
            styles.static2,
            styles['static3']
        ],
        dynamicStyles: [
            condition1 && styles.conditional1,
            styles.dynamic(...dynamicStyleArgs),
            condition2 && styles.conditional2,
            condition3 ? styles.conditional3 : styles.conditional4,
            condition5 ? styles.conditional5 : styles.conditional6
        ]
    });
    __AppendElement(el, el1);
    return [
        el,
        el1
    ];
}, [
    (snapshot, index, oldValue)=>ReactLynx.updateEvent(snapshot, index, oldValue, 0, "bindEvent", "tap", ''),
    function(ctx) {
        if (ctx.__elements) {
            __SetStyleObject(ctx.__elements[1], ctx.__values[1]);
        }
    }
], null, undefined, globDynamicComponentEntry, null);
function ComponentWithSimpleStyle({ condition1, condition2, condition3, condition5, dynamicStyleArgs }) {
    return <__snapshot_da39a_test_1 values={[
        1,
        __ConsumeSimpleStyle({
            staticStyles: [
                styles.static1,
                styles.static2,
                styles['static3']
            ],
            dynamicStyles: [
                condition1 && styles.conditional1,
                styles.dynamic(...dynamicStyleArgs),
                condition2 && styles.conditional2,
                condition3 ? styles.conditional3 : styles.conditional4,
                condition5 ? styles.conditional5 : styles.conditional6
            ]
        })
    ]}/>;
}
