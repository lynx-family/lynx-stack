import * as ReactLynx from "@lynx-js/react";
const __snapshot_da39a_test_1 = /*#__PURE__*/ ReactLynx.createSnapshot("__snapshot_da39a_test_1", function() {
    const pageId = ReactLynx.__pageId;
    const el = __CreateView(pageId);
    __SetInlineStyles(el, "background-color: red;");
    return [
        el
    ];
}, null, null, undefined, globDynamicComponentEntry);
<__snapshot_da39a_test_1/>;
const __snapshot_da39a_test_2 = /*#__PURE__*/ ReactLynx.createSnapshot("__snapshot_da39a_test_2", function() {
    const pageId = ReactLynx.__pageId;
    const el = __CreateView(pageId);
    return [
        el
    ];
}, [
    function(ctx) {
        if (ctx.__elements) {
            __SetInlineStyles(ctx.__elements[0], ctx.__values[0]);
        }
    }
], null, undefined, globDynamicComponentEntry);
<__snapshot_da39a_test_2 values={[
    `background-color: red; width: ${w};`
]}/>;
const __snapshot_da39a_test_3 = /*#__PURE__*/ ReactLynx.createSnapshot("__snapshot_da39a_test_3", function() {
    const pageId = ReactLynx.__pageId;
    const el = __CreateView(pageId);
    __AddInlineStyle(el, 7, "red");
    return [
        el
    ];
}, [
    function(ctx) {
        if (ctx.__elements) {
            let el = ctx.__elements[0];
            let style_values = ctx.__values[0];
            __AddInlineStyle(el, 27, style_values[0]), __AddInlineStyle(el, 26, style_values[1]);
        }
    }
], null, undefined, globDynamicComponentEntry);
<__snapshot_da39a_test_3 values={[
    [
        w,
        "100rpx"
    ]
]}/>;
const __snapshot_da39a_test_4 = /*#__PURE__*/ ReactLynx.createSnapshot("__snapshot_da39a_test_4", function() {
    const pageId = ReactLynx.__pageId;
    const el = __CreateView(pageId);
    return [
        el
    ];
}, [
    function(ctx) {
        if (ctx.__elements) {
            __SetInlineStyles(ctx.__elements[0], ctx.__values[0]);
        }
    }
], null, undefined, globDynamicComponentEntry);
<__snapshot_da39a_test_4 values={[
    {
        backgroundColor: "red",
        ...style
    }
]}/>;
