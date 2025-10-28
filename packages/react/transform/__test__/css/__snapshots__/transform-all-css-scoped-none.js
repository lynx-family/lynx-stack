import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
import * as ReactLynx from "@lynx-js/react";
import './foo.css';
import bar from './bar.css';
const __snapshot_2d408_test_1 = "__snapshot_2d408_test_1";
ReactLynx.snapshotCreatorMap[__snapshot_2d408_test_1] = ()=>ReactLynx.createSnapshot(__snapshot_2d408_test_1, function() {
        const pageId = ReactLynx.__pageId;
        const el = __CreateView(pageId);
        return [
            el
        ];
    }, null, null, undefined, globDynamicComponentEntry, null);
function App() {
    return /*#__PURE__*/ _jsx(Baz, {
        foo: /*#__PURE__*/ _jsx(__snapshot_2d408_test_1, {})
    });
}
bar, App;
