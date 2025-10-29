/*#__PURE__*/ import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
import * as ReactLynx from "@lynx-js/react";
const __snapshot_2d408_test_1 = "__snapshot_2d408_test_1";
ReactLynx.snapshotCreatorMap[__snapshot_2d408_test_1] = (__snapshot_2d408_test_1)=>ReactLynx.createSnapshot(__snapshot_2d408_test_1, function() {
        const pageId = ReactLynx.__pageId;
        const el = __CreateView(pageId);
        return [
            el
        ];
    }, null, null, undefined, globDynamicComponentEntry, null);
_jsx(__snapshot_2d408_test_1, {});
const __snapshot_2d408_test_2 = "__snapshot_2d408_test_2";
ReactLynx.snapshotCreatorMap[__snapshot_2d408_test_2] = (__snapshot_2d408_test_2)=>ReactLynx.createSnapshot(__snapshot_2d408_test_2, function() {
        const pageId = ReactLynx.__pageId;
        const el = __CreateText(pageId);
        const el1 = __CreateRawText("foo");
        __AppendElement(el, el1);
        return [
            el,
            el1
        ];
    }, null, null, undefined, globDynamicComponentEntry, null);
/*#__PURE__*/ _jsx(__snapshot_2d408_test_2, {});
const __snapshot_2d408_test_3 = "__snapshot_2d408_test_3";
ReactLynx.snapshotCreatorMap[__snapshot_2d408_test_3] = (__snapshot_2d408_test_3)=>ReactLynx.createSnapshot(__snapshot_2d408_test_3, function() {
        const pageId = ReactLynx.__pageId;
        const el = __CreateView(pageId);
        return [
            el
        ];
    }, null, null, undefined, globDynamicComponentEntry, null);
function Foo() {
    return /*#__PURE__*/ _jsx(Bar, {
        children: /*#__PURE__*/ _jsx(__snapshot_2d408_test_3, {})
    });
}
const __snapshot_2d408_test_4 = "__snapshot_2d408_test_4";
ReactLynx.snapshotCreatorMap[__snapshot_2d408_test_4] = (__snapshot_2d408_test_4)=>ReactLynx.createSnapshot(__snapshot_2d408_test_4, function() {
        const pageId = ReactLynx.__pageId;
        const el = __CreateView(pageId);
        return [
            el
        ];
    }, null, null, undefined, globDynamicComponentEntry, null);
function App() {
    return /*#__PURE__*/ _jsx(Baz, {
        foo: /*#__PURE__*/ _jsx(__snapshot_2d408_test_4, {})
    });
}
Foo, App;
