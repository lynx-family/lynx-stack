import * as ReactLynx from "@lynx-js/react";
let V = "foo";
const __snapshot_da39a_test_1 = "__snapshot_da39a_test_1";
ReactLynx.snapshotCreatorMap[__snapshot_da39a_test_1] = (__snapshot_da39a_test_1)=>ReactLynx.createSnapshot(__snapshot_da39a_test_1, function() {
        const pageId = ReactLynx.__pageId;
        const el = __CreateView(pageId);
        return [
            el
        ];
    }, [
        function(ctx) {
            if (ctx.__elements) {
                __SetAttribute(ctx.__elements[0], "custom-attr", ctx.__values[0]);
            }
        }
    ], null, undefined, globDynamicComponentEntry, null, true);
const a = <__snapshot_da39a_test_1 values={[
    V
]}/>;
