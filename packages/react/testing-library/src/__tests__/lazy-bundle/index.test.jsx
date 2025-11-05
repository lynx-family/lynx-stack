import '@testing-library/jest-dom';
import { expect, it, vi } from 'vitest';
import { render, screen, waitForElementToBeRemoved, act } from '@lynx-js/react/testing-library';
import { Suspense, lazy, useState } from '@lynx-js/react';
import { BackgroundSnapshotInstance } from '@lynx-js/react/internal';
import { Suspense as PreactSuspense } from 'preact/compat';
import { createRequire } from 'node:module';
import { describe } from 'node:test';
import { prettyFormatSnapshotPatch } from '../../../../runtime/lib/debug/formatPatch';

const SuspenseMap = {
  LynxSuspense: Suspense,
  PreactSuspense,
};

const require = createRequire(import.meta.url);

function LazyComponentLoader({ url }) {
  const ExternalComponent = lazy(() => import(url));
  const InternalComponent = lazy(() => import('./LazyComponent'));

  return (
    <Suspense fallback={<text>loading...</text>}>
      <InternalComponent />
      <ExternalComponent />
    </Suspense>
  );
}

export function App({ url }) {
  return (
    <view>
      <LazyComponentLoader url={url}></LazyComponentLoader>
    </view>
  );
}

describe('lazy bundle', () => {
  it('should render lazy component', async () => {
    const { container } = render(
      <App url={require.resolve('./LazyComponent.jsx')} />,
    );

    expect(container.firstChild).toMatchInlineSnapshot(`
      <view>
        <wrapper>
          <text>
            loading...
          </text>
        </wrapper>
      </view>
    `);

    await waitForElementToBeRemoved(() => screen.getByText('loading...'), {
      timeout: 50_000,
    });

    expect(container.firstChild).toMatchInlineSnapshot(`
      <view>
        <wrapper>
          <text>
            Hello from LazyComponent
          </text>
          <text>
            Hello from LazyComponent
          </text>
        </wrapper>
      </view>
    `);
  });
});

describe('Suspense', () => {
  beforeEach(() => {
    vi.clearAllTimers();
    vi.useFakeTimers({ toFake: ['setTimeout'] });
  });

  Object.entries(SuspenseMap).forEach(([name, Suspense]) => {
    it(`${name} with host element child`, async () => {
      vi.spyOn(lynxTestingEnv.backgroundThread.lynx, 'reportError');
      const reportErrorCalls = lynxTestingEnv.backgroundThread.lynx.reportError.mock.calls;
      vi.spyOn(lynxTestingEnv.backgroundThread.lynxCoreInject.tt, 'OnLifecycleEvent');
      const onLifecycleEventCalls = lynxTestingEnv.backgroundThread.lynxCoreInject.tt.OnLifecycleEvent.mock.calls;
      vi.spyOn(lynx.getNativeApp(), 'callLepusMethod');
      const callLepusMethodCalls = lynx.getNativeApp().callLepusMethod.mock.calls;

      const LazyComponent = lazy(() => import('./LazyComponent'));

      const tearDownInstances = [];

      const tearDown = BackgroundSnapshotInstance.prototype.tearDown;
      vi.spyOn(BackgroundSnapshotInstance.prototype, 'tearDown').mockImplementation(function() {
        tearDownInstances.push({
          __id: this.__id,
          type: this.type,
          create: this.__snapshot_def.create.toString(),
        });
        tearDown.call(this);
      });

      let setShowLazyComponent;
      const Comp = () => {
        const [showLazyComponent, _setShowLazyComponent] = useState(true);
        setShowLazyComponent = _setShowLazyComponent;

        return (
          <view className='root'>
            {showLazyComponent
              ? (
                <Suspense fallback={<text className='loading'>loading...</text>}>
                  <view className='lazy-wrapper'>
                    <LazyComponent />
                    <text>Hello, ReactLynx</text>
                    <LazyComponent />
                  </view>
                </Suspense>
              )
              : null}
          </view>
        );
      };

      const { container } = render(
        <Comp />,
      );

      if (name === 'PreactSuspense') {
        expect(container).toMatchInlineSnapshot(`
        <page>
          <view
            class="root"
          >
            <text
              class="loading"
            >
              loading...
            </text>
          </view>
        </page>
      `);
      } else {
        expect(container).toMatchInlineSnapshot(`
        <page>
          <view
            class="root"
          >
            <wrapper>
              <text
                class="loading"
              >
                loading...
              </text>
            </wrapper>
          </view>
        </page>
      `);
      }

      {
        const snapshotPatch = JSON.parse(callLepusMethodCalls[0][1]['data']).patchList[0].snapshotPatch;
        const formattedSnapshotPatch = prettyFormatSnapshotPatch(snapshotPatch);
        if (name === 'PreactSuspense') {
          expect(formattedSnapshotPatch).toMatchInlineSnapshot(`
            [
              {
                "id": 2,
                "op": "CreateElement",
                "type": "__snapshot_fffe1_test_3",
              },
              {
                "id": 7,
                "op": "CreateElement",
                "type": "__snapshot_fffe1_test_4",
              },
              {
                "beforeId": null,
                "childId": 7,
                "op": "InsertBefore",
                "parentId": 2,
              },
              {
                "beforeId": null,
                "childId": 2,
                "op": "InsertBefore",
                "parentId": -1,
              },
            ]
          `);
        } else {
          expect(formattedSnapshotPatch).toMatchInlineSnapshot(`
            [
              {
                "id": 2,
                "op": "CreateElement",
                "type": "__snapshot_fffe1_test_3",
              },
              {
                "id": 8,
                "op": "CreateElement",
                "type": "wrapper",
              },
              {
                "id": 9,
                "op": "CreateElement",
                "type": "__snapshot_fffe1_test_4",
              },
              {
                "beforeId": null,
                "childId": 9,
                "op": "InsertBefore",
                "parentId": 8,
              },
              {
                "beforeId": null,
                "childId": 8,
                "op": "InsertBefore",
                "parentId": 2,
              },
              {
                "beforeId": null,
                "childId": 2,
                "op": "InsertBefore",
                "parentId": -1,
              },
            ]
          `);
        }
      }

      await waitForElementToBeRemoved(() => screen.getByText('loading...'), {
        timeout: 50_000,
      });

      expect(reportErrorCalls).toMatchInlineSnapshot(`[]`);

      if (name === 'PreactSuspense') {
        expect(container).toMatchInlineSnapshot(`
        <page>
          <view
            class="root"
          >
            <view
              class="lazy-wrapper"
            >
              <wrapper>
                <text>
                  Hello from LazyComponent
                </text>
              </wrapper>
              <text>
                Hello, ReactLynx
              </text>
              <wrapper>
                <text>
                  Hello from LazyComponent
                </text>
              </wrapper>
            </view>
          </view>
        </page>
      `);
      } else {
        expect(container).toMatchInlineSnapshot(`
          <page>
            <view
              class="root"
            >
              <wrapper>
                <view
                  class="lazy-wrapper"
                >
                  <wrapper>
                    <text>
                      Hello from LazyComponent
                    </text>
                  </wrapper>
                  <text>
                    Hello, ReactLynx
                  </text>
                  <wrapper>
                    <text>
                      Hello from LazyComponent
                    </text>
                  </wrapper>
                </view>
              </wrapper>
            </view>
          </page>
        `);
      }

      vi.runAllTimers();
      if (name === 'PreactSuspense') {
        // <view className="lazy-wrapper"> is torn down, (it is triggered in first render but delayed 10_000ms to execute, we use `vi.runAllTimers()` to simulate the situation that will cause the bug)
        // <text>loading...</text> is torn down
        expect(tearDownInstances).toMatchInlineSnapshot(`
          [
            {
              "__id": 3,
              "create": "function() {
            const pageId = __vite_ssr_import_1__.__pageId;
            const el = __CreateView(pageId);
            __SetClasses(el, "lazy-wrapper");
            const el1 = __CreateWrapperElement(pageId);
            __AppendElement(el, el1);
            const el2 = __CreateText(pageId);
            __AppendElement(el, el2);
            const el3 = __CreateRawText("Hello, ReactLynx");
            __AppendElement(el2, el3);
            const el4 = __CreateWrapperElement(pageId);
            __AppendElement(el, el4);
            return [
              el,
              el1,
              el2,
              el3,
              el4
            ];
          }",
              "type": "__snapshot_fffe1_test_5",
            },
            {
              "__id": 7,
              "create": "function() {
            const pageId = __vite_ssr_import_1__.__pageId;
            const el = __CreateText(pageId);
            __SetClasses(el, "loading");
            const el1 = __CreateRawText("loading...");
            __AppendElement(el, el1);
            return [
              el,
              el1
            ];
          }",
              "type": "__snapshot_fffe1_test_4",
            },
          ]
        `);
      } else {
        expect(tearDownInstances).toMatchInlineSnapshot(`
          [
            {
              "__id": 8,
              "create": "create () {
                              /* v8 ignore start */ if (__JS__ && !__DEV__) return [];
                              /* v8 ignore stop */ return [
                                  __CreateWrapperElement(__pageId)
                              ];
                          }",
              "type": "wrapper",
            },
          ]
        `);
      }

      act(() => {
        setShowLazyComponent(false);
      });

      {
        const snapshotPatch = JSON.parse(callLepusMethodCalls[2][1]['data']).patchList[0].snapshotPatch;
        const formattedSnapshotPatch = prettyFormatSnapshotPatch(snapshotPatch);
        if (name === 'PreactSuspense') {
          // since <view className="lazy-wrapper"> is torn down
          // preact will not remove lazy-wrapper, so main-thread
          // will always keep "lazy-wrapper"
          expect(formattedSnapshotPatch).toMatchInlineSnapshot(`[]`);
        } else {
          expect(formattedSnapshotPatch).toMatchInlineSnapshot(`
          [
            {
              "childId": 3,
              "op": "RemoveChild",
              "parentId": 2,
            },
          ]
        `);
        }
      }

      if (name === 'PreactSuspense') {
        expect(container).toMatchInlineSnapshot(`
      <page>
        <view
          class="root"
        >
          <view
            class="lazy-wrapper"
          >
            <wrapper>
              <text>
                Hello from LazyComponent
              </text>
            </wrapper>
            <text>
              Hello, ReactLynx
            </text>
            <wrapper>
              <text>
                Hello from LazyComponent
              </text>
            </wrapper>
          </view>
        </view>
      </page>
    `);
      } else {
        expect(container).toMatchInlineSnapshot(`
        <page>
          <view
            class="root"
          />
        </page>
      `);
      }

      act(() => {
        setShowLazyComponent(true);
      });
      if (name === 'PreactSuspense') {
        // Now it will cause duplicate error here
        expect(container).toMatchInlineSnapshot(`
        <page>
          <view
            class="root"
          >
            <view
              class="lazy-wrapper"
            >
              <wrapper>
                <text>
                  Hello from LazyComponent
                </text>
              </wrapper>
              <text>
                Hello, ReactLynx
              </text>
              <wrapper>
                <text>
                  Hello from LazyComponent
                </text>
              </wrapper>
            </view>
            <view
              class="lazy-wrapper"
            >
              <wrapper>
                <text>
                  Hello from LazyComponent
                </text>
              </wrapper>
              <text>
                Hello, ReactLynx
              </text>
              <wrapper>
                <text>
                  Hello from LazyComponent
                </text>
              </wrapper>
            </view>
          </view>
        </page>
      `);
      } else {
        // Our LynxSuspense works fine
        expect(container).toMatchInlineSnapshot(`
          <page>
            <view
              class="root"
            >
              <wrapper>
                <view
                  class="lazy-wrapper"
                >
                  <wrapper>
                    <text>
                      Hello from LazyComponent
                    </text>
                  </wrapper>
                  <text>
                    Hello, ReactLynx
                  </text>
                  <wrapper>
                    <text>
                      Hello from LazyComponent
                    </text>
                  </wrapper>
                </view>
              </wrapper>
            </view>
          </page>
        `);
      }

      if (name === 'PreactSuspense') {
        expect(container.firstChild.children.length).toBe(2);
      } else {
        expect(container.firstChild.children.length).toBe(1);
      }
    });
  });
});
