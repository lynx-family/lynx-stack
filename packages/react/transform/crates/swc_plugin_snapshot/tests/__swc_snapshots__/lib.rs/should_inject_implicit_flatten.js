import * as ReactLynx from "@lynx-js/react";
<<<<<<< HEAD:packages/react/transform/tests/__swc_snapshots__/src/swc_plugin_snapshot/mod.rs/should_inject_implicit_flatten.js
const __snapshot_da39a_test_1 = /*#__PURE__*/ ReactLynx.createSnapshot("__snapshot_da39a_test_1", function() {
=======
const __snapshot_da39a_test_2 = ReactLynx.createSnapshot("__snapshot_da39a_test_2", function() {
    const pageId = ReactLynx.__pageId;
    const el = __CreateView(pageId);
    __SetClasses(el, 'commdityV1TextVerticalWrapper');
    return [
        el
    ];
}, null, ReactLynx.__DynamicPartChildren_0, undefined, globDynamicComponentEntry, null);
const __snapshot_da39a_test_1 = ReactLynx.createSnapshot("__snapshot_da39a_test_1", function() {
>>>>>>> gh/main:packages/react/transform/crates/swc_plugin_snapshot/tests/__swc_snapshots__/lib.rs/should_inject_implicit_flatten.js
    const pageId = ReactLynx.__pageId;
    const el = __CreateView(pageId);
    const el1 = __CreateView(pageId);
    __SetClasses(el1, 'commdityV1Wrapper');
    __AppendElement(el, el1);
    const el2 = __CreateView(pageId);
    __SetClasses(el2, 'dotComm');
    __AppendElement(el1, el2);
    const el3 = __CreateView(pageId);
    __SetClasses(el3, 'commdityV1TextWrapper');
    __AppendElement(el1, el3);
    const el4 = __CreateView(pageId);
    __SetClasses(el4, 'commdityV1TextVerticalWrapper');
    __AppendElement(el3, el4);
    const el5 = __CreateWrapperElement(pageId);
    __AppendElement(el3, el5);
    const el6 = __CreateWrapperElement(pageId);
    __AppendElement(el1, el6);
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
    function(ctx) {
        if (ctx.__elements) {
            __SetID(ctx.__elements[2], ctx.__values[0]);
        }
    }
], [
    [
        ReactLynx.__DynamicPartSlotV2,
        4
    ],
    [
        ReactLynx.__DynamicPartSlotV2,
        5
    ],
    [
        ReactLynx.__DynamicPartSlotV2,
        6
    ]
], undefined, globDynamicComponentEntry, null);
<__snapshot_da39a_test_1 values={[
    id
]} $0={[
    <ItemTextWithTag/>,
    desc
]} $1={unit} $2={[
    unit,
    unit
]}/>;
