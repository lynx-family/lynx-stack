import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
import * as ReactLynx from "@lynx-js/react";
import './foo.css';
import bar from './bar.css';
import * as styles from './baz.scss';
import { styles0, styles1 } from './foo.modules.css';
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
    ], null, undefined, globDynamicComponentEntry, null, true);
/*#__PURE__*/ _jsx(__snapshot_2d408_test_1, {
    values: [
        `foo ${styles.bar} ${styles2.baz} ${clsA} ${clsB}`
    ]
});
bar, styles, styles0, styles1;
