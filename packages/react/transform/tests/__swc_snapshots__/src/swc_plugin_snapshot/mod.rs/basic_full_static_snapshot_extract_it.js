import * as ReactLynx from "@lynx-js/react";
const __snapshot_da39a_test_1 = /*#__PURE__*/ ReactLynx.createSnapshot("__snapshot_da39a_test_1", function() {
    const pageId = ReactLynx.__pageId;
    const el = __CreateView(pageId);
    const el1 = __CreateText(pageId);
    __AppendElement(el, el1);
    const el2 = __CreateRawText("!!!");
    __AppendElement(el1, el2);
    return [
        el,
        el1,
        el2
    ];
}, null, null, undefined, globDynamicComponentEntry);
it('basic', async function() {
    const run = withEnv(function() {
        let s = __snapshot_da39a_test_1;
    });
    await run();
});
