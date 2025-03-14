import { root } from "@lynx-js/react";
import { update } from "@lynx-js/test-tools/update.js";

import { App } from "./app.jsx";

const createFn = vi.fn();
vi.stubGlobal("__RenderContent", (vnode) => {
  createFn(vnode.props.children);
  return vnode;
});

const callLepusMethod = vi.fn((_, __, callback) => {
  callback();
});
vi.stubGlobal("lynx", {
  getNativeApp() {
    return {
      callLepusMethod,
    };
  },
});

root.render(
  <page>
    <App />
  </page>
);

callLepusMethod.mockClear();

console.profile = vi.fn();
console.profileEnd = vi.fn();

// Mocking Hydration
lynxCoreInject.tt.OnLifecycleEvent([
  "rLynxFirstScreen",
  {
    root: '{"values":[]}',
  },
]);

it("should call renderer", () =>
  new Promise((done) => {
    expect(createFn.mock.calls[0][0]).toEqual("content 1");
    NEXT(
      update(done, true, () => {
        expect(createFn.mock.calls[1][0]).toEqual("content 2");

        const { patchList } = JSON.parse(
          callLepusMethod.mock.calls[1][1].data
        );
        expect(patchList.length).toEqual(1);
        const { snapshotPatch } = patchList[0];
        // Should have updates
        expect(snapshotPatch.length).toBeGreaterThan(0);
        // Should not have AddSnapshot
        expect(
          snapshotPatch.filter(
            (patch) =>
              patch === /** SnapshotOperation.DEV_ONLY_AddSnapshot */ 100
          )
        ).toHaveLength(1);

        NEXT(
          update(done, true, () => {
            expect(createFn.mock.calls[2][0]).toEqual("content 3");
            const { snapshotPatch } = JSON.parse(
              callLepusMethod.mock.calls[2][1].data
            );
            // Should have updates
            expect(snapshotPatch.length).toBeGreaterThan(0);
            // Should not have AddSnapshot

            expect(
              snapshotPatch.filter(
                (patch) =>
                  patch === /** SnapshotOperation.DEV_ONLY_AddSnapshot */ 100
              )
            ).toHaveLength(1);
            done();
          })
        );
      })
    );
  }));

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept("./app.jsx");
}
