import * as ReactLynx from "@lynx-js/react";
const __snapshot_da39a_test_1 = "__snapshot_da39a_test_1";
ReactLynx.snapshotCreatorMap[__snapshot_da39a_test_1] = (__snapshot_da39a_test_1)=>ReactLynx.createSnapshot(__snapshot_da39a_test_1, function(snapshotInstance) {
        const pageId = ReactLynx.__pageId;
        const el = ReactLynx.snapshotCreateList(pageId, snapshotInstance, 0);
        const el1 = __CreateElement("list-item", pageId);
        __AppendElement(el, el1);
        return [
            el,
            el1
        ];
    }, [
        (snapshot, index, oldValue)=>ReactLynx.updateSpread(snapshot, index, oldValue, 1)
    ], null, undefined, globDynamicComponentEntry, [
        0
    ], true);
const node = <__snapshot_da39a_test_1 values={[
    {
        ...getProps(),
        __spread: true
    }
]} __listItemPlatformInfoIndex={0}/>;
