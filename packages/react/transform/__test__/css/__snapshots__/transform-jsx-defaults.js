/*#__PURE__*/ import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
import * as ReactLynx from "@lynx-js/react";
const __snapshot_da39a_6c7c44b_1 = /*#__PURE__*/ ReactLynx.createSnapshot("__snapshot_da39a_6c7c44b_1", function() {
    const pageId = ReactLynx.__pageId;
    const el = __CreateView(pageId);
    return [
        el
    ];
}, null, null, undefined, globDynamicComponentEntry);
_jsx(__snapshot_da39a_6c7c44b_1, {});
const __snapshot_da39a_6c7c44b_2 = /*#__PURE__*/ ReactLynx.createSnapshot("__snapshot_da39a_6c7c44b_2", function() {
    const pageId = ReactLynx.__pageId;
    const el = __CreateText(pageId);
    const el1 = __CreateRawText("foo");
    __AppendElement(el, el1);
    return [
        el,
        el1
    ];
}, null, null, undefined, globDynamicComponentEntry);
/*#__PURE__*/ _jsx(__snapshot_da39a_6c7c44b_2, {});
const __snapshot_da39a_6c7c44b_3 = /*#__PURE__*/ ReactLynx.createSnapshot("__snapshot_da39a_6c7c44b_3", function() {
    const pageId = ReactLynx.__pageId;
    const el = __CreateView(pageId);
    return [
        el
    ];
}, null, null, undefined, globDynamicComponentEntry);
function Foo() {
    return /*#__PURE__*/ _jsx(Bar, {
        children: /*#__PURE__*/ _jsx(__snapshot_da39a_6c7c44b_3, {})
    });
}
const __snapshot_da39a_6c7c44b_4 = /*#__PURE__*/ ReactLynx.createSnapshot("__snapshot_da39a_6c7c44b_4", function() {
    const pageId = ReactLynx.__pageId;
    const el = __CreateView(pageId);
    return [
        el
    ];
}, null, null, undefined, globDynamicComponentEntry);
function App() {
    return /*#__PURE__*/ _jsx(Baz, {
        foo: /*#__PURE__*/ _jsx(__snapshot_da39a_6c7c44b_4, {})
    });
}
Foo, App;
