/*#__PURE__*/ import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
import * as ReactLynx from "@lynx-js/react";
const __snapshot_da39a_4683e_1 = "__snapshot_da39a_4683e_1";
ReactLynx.snapshotCreatorMap[__snapshot_da39a_4683e_1] = (__snapshot_da39a_4683e_1)=>ReactLynx.createSnapshot(__snapshot_da39a_4683e_1, function() {
        const pageId = ReactLynx.__pageId;
        const el = __CreateView(pageId);
        return [
            el
        ];
    }, null, null, undefined, globDynamicComponentEntry, null);
_jsx(__snapshot_da39a_4683e_1, {});
const __snapshot_da39a_4683e_2 = "__snapshot_da39a_4683e_2";
ReactLynx.snapshotCreatorMap[__snapshot_da39a_4683e_2] = (__snapshot_da39a_4683e_2)=>ReactLynx.createSnapshot(__snapshot_da39a_4683e_2, function() {
        const pageId = ReactLynx.__pageId;
        const el = __CreateText(pageId);
        const el1 = __CreateRawText("foo");
        __AppendElement(el, el1);
        return [
            el,
            el1
        ];
    }, null, null, undefined, globDynamicComponentEntry, null);
/*#__PURE__*/ _jsx(__snapshot_da39a_4683e_2, {});
const __snapshot_da39a_4683e_3 = "__snapshot_da39a_4683e_3";
ReactLynx.snapshotCreatorMap[__snapshot_da39a_4683e_3] = (__snapshot_da39a_4683e_3)=>ReactLynx.createSnapshot(__snapshot_da39a_4683e_3, function() {
        const pageId = ReactLynx.__pageId;
        const el = __CreateView(pageId);
        return [
            el
        ];
    }, null, null, undefined, globDynamicComponentEntry, null);
function Foo() {
    return /*#__PURE__*/ _jsx(Bar, {
        children: /*#__PURE__*/ _jsx(__snapshot_da39a_4683e_3, {})
    });
}
const __snapshot_da39a_4683e_4 = "__snapshot_da39a_4683e_4";
ReactLynx.snapshotCreatorMap[__snapshot_da39a_4683e_4] = (__snapshot_da39a_4683e_4)=>ReactLynx.createSnapshot(__snapshot_da39a_4683e_4, function() {
        const pageId = ReactLynx.__pageId;
        const el = __CreateView(pageId);
        return [
            el
        ];
    }, null, null, undefined, globDynamicComponentEntry, null);
function App() {
    return /*#__PURE__*/ _jsx(Baz, {
        foo: /*#__PURE__*/ _jsx(__snapshot_da39a_4683e_4, {})
    });
}
Foo, App;
