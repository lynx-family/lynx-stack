import * as ReactLynx from "@lynx-js/react";
import { SimpleStyleSheet } from '@lynx-js/react';
const styles = SimpleStyleSheet.create({
    static1: {
        27: '100px',
        26: '100px'
    },
    static2: {
        7: 'blue',
        22: 'green'
    },
    static3: {
        44: 'center',
        24: 'flex'
    },
    conditional1: {
        21: '1px',
        11: 'red',
        118: 'solid'
    },
    conditional2: {
        20: '1px',
        10: 'red',
        117: 'solid'
    },
    conditional3: {
        19: '1px',
        9: 'red',
        116: 'solid'
    },
    conditional4: {
        19: '2px',
        9: 'blue',
        116: 'dashed'
    },
    conditional5: {
        47: '12px'
    },
    conditional6: {},
    dynamic: (color, size)=>({
            8: color,
            18: '1px',
            115: 'solid',
            35: size
        })
});
const __snapshot_da39a_test_1 = ReactLynx.createSnapshot("__snapshot_da39a_test_1", function(snapshotInstance) {
    const pageId = ReactLynx.__pageId;
    const el = __CreateView(pageId);
    __SetClasses(el, "root");
    const el1 = __CreateView(pageId);
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
        [
            styles.static1,
            styles.static2,
            styles['static3'],
            condition1 && styles.conditional1,
            styles.dynamic(...dynamicStyleArgs),
            condition2 && styles.conditional2,
            condition3 ? styles.conditional3 : styles.conditional4,
            condition5 ? styles.conditional5 : styles.conditional6
        ]
    ]}/>;
}
