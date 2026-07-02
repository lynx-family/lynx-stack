import * as ReactLynx from "@lynx-js/react";
const __snapshot_da39a_test_1 = "__snapshot_da39a_test_1";
ReactLynx.snapshotCreatorMap[__snapshot_da39a_test_1] = (__snapshot_da39a_test_1)=>ReactLynx.createSnapshot(__snapshot_da39a_test_1, function() {
        const pageId = ReactLynx.__pageId;
        const el = __CreateView(pageId);
        const el1 = __CreateElement("list-item", pageId);
        __AppendElement(el, el1);
        return [
            el,
            el1
        ];
    }, [
        function(ctx) {
            if (ctx.__elements) {
                __SetID(ctx.__elements[0], ctx.__values[0]);
            }
        },
        (snapshot, index, oldValue)=>ReactLynx.updateListItemPlatformInfo(snapshot, index, oldValue, 1)
    ], null, undefined, globDynamicComponentEntry, null, true);
const node = <__snapshot_da39a_test_1 values={[
    getViewId(),
    {
        "item-key": getItemKey()
    }
]} __listItemPlatformInfoIndex={1}/>;
