/*@jsxCSSId 1185352*/ import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
import * as ReactLynx from "@lynx-js/react";
import "./foo.css?cssId=1185352";
import bar from "./bar.css?cssId=1185352";
import * as styles from "./baz.scss?cssId=1185352";
import { styles0, styles1 } from "./foo.modules.css?cssId=1185352";
const __snapshot_2d408_test_1 = "__snapshot_2d408_test_1";
ReactLynx.snapshotCreatorMap[__snapshot_2d408_test_1] = (__snapshot_2d408_test_1)=>ReactLynx.createSnapshot(__snapshot_2d408_test_1, function() {
        const pageId = ReactLynx.__pageId;
        const el = __CreateView(pageId);
        return [
            el
        ];
    }, [
        function(ctx) {
            if (ctx.__elements) __SetClasses(ctx.__elements[0], ctx.__values[0] || '');
        }
    ], null, 1185352, globDynamicComponentEntry, null);
/*#__PURE__*/ _jsx(__snapshot_2d408_test_1, {
    values: [
        `foo ${styles.bar} ${styles2.baz} ${clsA} ${clsB}`
    ]
});
bar, styles, styles0, styles1;
