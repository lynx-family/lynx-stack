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
    }
};
const __snapshot_da39a_test_1 = ReactLynx.createSnapshot("__snapshot_da39a_test_1", function(snapshotInstance) {
    __SimpleStyleInject("db4cf10", "width", "100px");
    __SimpleStyleInject("356935a", "height", "100px");
    __SimpleStyleInject("fa2e1f7", "background-color", "blue");
    __SimpleStyleInject("9cdf81d", "color", "green");
    __SimpleStyleInject("91a8701", "text-align", "center");
    __SimpleStyleInject("75816ca", "display", "flex");
    const pageId = ReactLynx.__pageId;
    const el = __CreateView(pageId);
    __SetClasses(el, "root");
    const el1 = __CreateView(pageId);
    __SetStyleObject(el1, [
        "db4cf10",
        "356935a",
        "fa2e1f7",
        "9cdf81d",
        "91a8701",
        "75816ca"
    ]);
    __AppendElement(el, el1);
    const el2 = __CreateView(pageId);
    __SetStyleObject(el2, [
        "db4cf10",
        "356935a",
        "fa2e1f7",
        "9cdf81d",
        "91a8701",
        "75816ca"
    ]);
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
