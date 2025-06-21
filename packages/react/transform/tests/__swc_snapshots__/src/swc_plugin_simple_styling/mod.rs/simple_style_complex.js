import * as ReactLynx from "@lynx-js/react";
import { SimpleStyleSheet } from '@lynx-js/react';
const styles = {
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
            35: size
        })
};
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
    __SimpleStyleInject("db4cf10", "width", "100px");
    __SimpleStyleInject("356935a", "height", "100px");
    __SimpleStyleInject("fa2e1f7", "background-color", "blue");
    __SimpleStyleInject("9cdf81d", "color", "green");
    __SimpleStyleInject("91a8701", "text-align", "center");
    __SimpleStyleInject("75816ca", "display", "flex");
    __SimpleStyleInject("e734863", "border-bottom-width", "1px");
    __SimpleStyleInject("81b9601", "border-bottom-color", "red");
    __SimpleStyleInject("b692b3c", "border-bottom-style", "solid");
    __SimpleStyleInject("84d5022", "border-top-width", "1px");
    __SimpleStyleInject("6bffc6e", "border-top-color", "red");
    __SimpleStyleInject("005f2ef", "border-top-style", "solid");
    __SimpleStyleInject("2d662a9", "border-right-width", "1px");
    __SimpleStyleInject("e747b32", "border-right-color", "red");
    __SimpleStyleInject("a8be028", "border-right-style", "solid");
    __SimpleStyleInject("1fad3eb", "border-right-width", "2px");
    __SimpleStyleInject("f71c730", "border-right-color", "blue");
    __SimpleStyleInject("3cefb4b", "border-right-style", "dashed");
    __SimpleStyleInject("6cb285c", "font-size", "12px");
    __SimpleStyleInject("bad68fd", "border-left-width", "1px");
    __SimpleStyleInject("f61f6f2", "border-left-style", "solid");
    return <__snapshot_da39a_test_1 values={[
        1,
        [
            "db4cf10",
            "356935a",
            "fa2e1f7",
            "9cdf81d",
            "91a8701",
            "75816ca",
            "bad68fd",
            "f61f6f2",
            condition1 && [
                "e734863",
                "81b9601",
                "b692b3c"
            ],
            styles.dynamic(...dynamicStyleArgs),
            condition2 && [
                "84d5022",
                "6bffc6e",
                "005f2ef"
            ],
            condition3 ? [
                "2d662a9",
                "e747b32",
                "a8be028"
            ] : [
                "1fad3eb",
                "f71c730",
                "3cefb4b"
            ],
            condition5 ? [
                "6cb285c"
            ] : []
        ]
    ]}/>;
}
