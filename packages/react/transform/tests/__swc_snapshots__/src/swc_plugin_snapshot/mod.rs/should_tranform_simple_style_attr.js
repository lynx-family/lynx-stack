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
    __DefineSimpleStyle(snapshotInstance, el, [
        styles.static1,
        styles.static2,
        styles.static3,
        condition1 && styles.conditional1,
        styles.dynamic(...dynamicStyleArgs),
        condition2 && styles.conditional2
    ]);
    return [
        el
    ];
}, [
    function(ctx) {
        if (ctx.__elements) {
            ReactLynx.updateSimpleStyle(ctx, ctx.__values[0]);
        }
    }
], null, undefined, globDynamicComponentEntry);
function ComponentWithSimpleStyle({ condition1, condition2, dynamicStyleArgs }) {
    return <__snapshot_da39a_test_1 values={[
        [
            condition1 && styles.conditional1,
            styles.dynamic(...dynamicStyleArgs),
            condition2 && styles.conditional2
        ]
    ]}/>;
}
