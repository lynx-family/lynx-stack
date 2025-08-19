import { render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { replaceCommitHook } from '../../src/lifecycle/patch/commit';
import { root } from '../../src/lynx-api';
import { __root } from '../../src/root';
import { setupPage } from '../../src/snapshot';
import { globalEnvManager } from '../utils/envManager';
import { formattedPatch } from '../utils/formatPatch';
import { mtcComponentTypes } from '../../src/mtc/mtcComponentTypes';
import { elementTree } from '../utils/nativeMethod';
import { mtcComponentVNodes } from '../../src/mtc/mtcComponentVNodes';
import { pickJSXFromProps } from '../../src/mtc/pickJSXFromProps';
import { renderMTCSlot, renderFakeMTCSlot } from '../../src/mtc/renderMTCSlot';
import { snapshotInstanceManager } from '../../src/snapshot';

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
  replaceCommitHook();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
});

afterEach(() => {
  vi.restoreAllMocks();
  mtcComponentVNodes.clear();
  mtcComponentTypes.clear();
  elementTree.clear();
});

describe('MTC updating - main thread side', () => {
  it('should update BTC in MTC when updating', () => {
    const InnerBTC = ({ btcText }) => {
      return (
        <view component={'InnerBTC'}>
          <text>
            {btcText}
          </text>
        </view>
      );
    };

    const MTC = ({ btc }) => {
      return (
        <view component={'MTC'}>
          <text>mtc</text>
          {renderMTCSlot(btc)}
        </view>
      );
    };

    const FakeMTC = (props) => {
      const [jsxs, transformedProps] = pickJSXFromProps(props);

      return (
        <mtc-container
          props={{
            __MTCProps: {
              componentInstanceId: 1,
              componentTypeId: 1,
            },
            ...transformedProps,
          }}
        >
          {renderFakeMTCSlot(jsxs)}
        </mtc-container>
      );
    };

    const BTC = ({ showMTC = false, text, showBTC = true }) => {
      return (
        <view>
          {showMTC ? <FakeMTC btc={showBTC ? <InnerBTC btcText={text} /> : null} /> : null}
        </view>
      );
    };

    mtcComponentTypes.set(1, MTC);

    // 1. render MTS without MTC
    {
      __root.__jsx = <BTC />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view />
        </page>
      `);
    }

    // 2. render BTC without MTC
    {
      globalEnvManager.switchToBackground();
      root.render(<BTC />);
    }

    // 3. hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      lynx.getNativeApp().callLepusMethod.mockClear();
    }

    // 4. BTS render MTC
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      render(<BTC showMTC={true} text={'btc'} />, __root);
      expect(formattedPatch()).toMatchInlineSnapshot(`
        [
          [
            {
              "id": 3,
              "op": "CreateElement",
              "type": "__Card__:__snapshot_a94a8_test_3",
            },
            {
              "id": 3,
              "op": "SetAttributes",
              "values": [
                {
                  "__MTCProps": {
                    "componentInstanceId": 1,
                    "componentTypeId": 1,
                  },
                  "btc": {
                    "$$typeof": "__MTC_SLOT__",
                    "i": 5,
                  },
                },
              ],
            },
            {
              "id": 4,
              "op": "CreateElement",
              "type": "wrapper",
            },
            {
              "id": 5,
              "op": "CreateElement",
              "type": "__Card__:__snapshot_a94a8_test_1",
            },
            {
              "id": 6,
              "op": "CreateElement",
              "type": null,
            },
            {
              "dynamicPartIndex": 0,
              "id": 6,
              "op": "SetAttribute",
              "value": "btc",
            },
            {
              "beforeId": null,
              "childId": 6,
              "op": "InsertBefore",
              "parentId": 5,
            },
            {
              "beforeId": null,
              "childId": 5,
              "op": "InsertBefore",
              "parentId": 4,
            },
            {
              "beforeId": null,
              "childId": 4,
              "op": "InsertBefore",
              "parentId": 3,
            },
            {
              "beforeId": null,
              "childId": 3,
              "op": "InsertBefore",
              "parentId": -2,
            },
          ],
        ]
      `);
    }

    // 5. update MTS to show MTC
    {
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      lynx.getNativeApp().callLepusMethod.mockClear();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <mtc-container>
              <view
                component="MTC"
              >
                <text>
                  <raw-text
                    text="mtc"
                  />
                </text>
                <wrapper>
                  <wrapper>
                    <view
                      component="InnerBTC"
                    >
                      <text>
                        <raw-text
                          text="btc"
                        />
                      </text>
                    </view>
                  </wrapper>
                </wrapper>
              </view>
              <wrapper />
            </mtc-container>
          </view>
        </page>
      `);
    }

    // 6. BTS update BTC
    {
      globalEnvManager.switchToBackground();
      render(<BTC showMTC={true} text={'btc-updated'} />, __root);
      expect(formattedPatch()).toMatchInlineSnapshot(`
        [
          [
            {
              "dynamicPartIndex": 0,
              "id": 3,
              "op": "SetAttribute",
              "value": {
                "__MTCProps": {
                  "componentInstanceId": 1,
                  "componentTypeId": 1,
                },
                "btc": {
                  "$$typeof": "__MTC_SLOT__",
                  "i": 5,
                },
              },
            },
            {
              "dynamicPartIndex": 0,
              "id": 6,
              "op": "SetAttribute",
              "value": "btc-updated",
            },
          ],
        ]
      `);
    }

    // 7. MTS update BTC
    {
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      lynx.getNativeApp().callLepusMethod.mockClear();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <mtc-container>
              <view
                component="MTC"
              >
                <text>
                  <raw-text
                    text="mtc"
                  />
                </text>
                <wrapper>
                  <wrapper>
                    <view
                      component="InnerBTC"
                    >
                      <text>
                        <raw-text
                          text="btc-updated"
                        />
                      </text>
                    </view>
                  </wrapper>
                </wrapper>
              </view>
              <wrapper />
            </mtc-container>
          </view>
        </page>
      `);
    }

    // 8. BTS remove BTC
    {
      globalEnvManager.switchToBackground();
      render(<BTC showMTC={true} text={'btc-updated'} showBTC={false} />, __root);
      expect(formattedPatch()).toMatchInlineSnapshot(`
        [
          [
            {
              "dynamicPartIndex": 0,
              "id": 3,
              "op": "SetAttribute",
              "value": {
                "__MTCProps": {
                  "componentInstanceId": 1,
                  "componentTypeId": 1,
                },
                "btc": null,
              },
            },
            {
              "childId": 4,
              "op": "RemoveChild",
              "parentId": 3,
            },
          ],
        ]
      `);
    }

    // 9. MTS remove BTC
    {
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      lynx.getNativeApp().callLepusMethod.mockClear();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <mtc-container>
              <view
                component="MTC"
              >
                <text>
                  <raw-text
                    text="mtc"
                  />
                </text>
                <wrapper />
              </view>
            </mtc-container>
          </view>
        </page>
      `);
    }
  });

  it('should update BTC in MTC when updating recursively', () => {
    const InnerBTC = ({ btcText }) => {
      return (
        <view component={'InnerBTC'}>
          <text>
            {btcText + ' Inner'}
          </text>
        </view>
      );
    };

    const InnerMTC = ({ btc }) => {
      return (
        <view component={'InnerMTC'}>
          <text>InnerMTC</text>
          {renderMTCSlot(btc)}
        </view>
      );
    };

    const OuterMTC = ({ btc }) => {
      return (
        <view component={'OuterMTC'}>
          <text>OuterMTC</text>
          {renderMTCSlot(btc)}
        </view>
      );
    };

    const OuterBTC = ({ btcText }) => {
      return (
        <view component={'OuterBTC'}>
          <text>
            {btcText + ' Outer'}
          </text>
          <FakeMTC componentInstanceId={2} componentTypeId={2} btc={<InnerBTC btcText={btcText} />} />
        </view>
      );
    };

    const FakeMTC = (props) => {
      const [jsxs, transformedProps] = pickJSXFromProps(props);

      return (
        <mtc-container
          props={{
            __MTCProps: {
              componentInstanceId: props.componentInstanceId,
              componentTypeId: props.componentTypeId,
            },
            ...transformedProps,
          }}
        >
          {renderFakeMTCSlot(jsxs)}
        </mtc-container>
      );
    };

    const BTC = ({ showMTC = false, text, showBTC = true }) => {
      return (
        <view>
          {showMTC
            ? (
              <FakeMTC
                componentInstanceId={1}
                componentTypeId={1}
                btc={showBTC ? <OuterBTC btcText={text} /> : null}
              />
            )
            : null}
        </view>
      );
    };

    mtcComponentTypes.set(1, OuterMTC);
    mtcComponentTypes.set(2, InnerMTC);

    // 1. render MTS without MTC
    {
      __root.__jsx = <BTC />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view />
        </page>
      `);
    }

    // 2. render BTC without MTC
    {
      globalEnvManager.switchToBackground();
      root.render(<BTC />);
    }

    // 3. hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      lynx.getNativeApp().callLepusMethod.mockClear();
    }

    // 4. BTS render MTC
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      render(<BTC showMTC={true} text={'btc'} />, __root);
      expect(formattedPatch()).toMatchInlineSnapshot(`
        [
          [
            {
              "id": 3,
              "op": "CreateElement",
              "type": "__Card__:__snapshot_a94a8_test_10",
            },
            {
              "id": 3,
              "op": "SetAttributes",
              "values": [
                {
                  "__MTCProps": {
                    "componentInstanceId": 1,
                    "componentTypeId": 1,
                  },
                  "btc": {
                    "$$typeof": "__MTC_SLOT__",
                    "i": 5,
                  },
                  "componentInstanceId": 1,
                  "componentTypeId": 1,
                },
              ],
            },
            {
              "id": 4,
              "op": "CreateElement",
              "type": "wrapper",
            },
            {
              "id": 5,
              "op": "CreateElement",
              "type": "__Card__:__snapshot_a94a8_test_8",
            },
            {
              "id": 6,
              "op": "CreateElement",
              "type": "__Card__:__snapshot_a94a8_test_9",
            },
            {
              "id": 7,
              "op": "CreateElement",
              "type": null,
            },
            {
              "dynamicPartIndex": 0,
              "id": 7,
              "op": "SetAttribute",
              "value": "btc Outer",
            },
            {
              "beforeId": null,
              "childId": 7,
              "op": "InsertBefore",
              "parentId": 6,
            },
            {
              "beforeId": null,
              "childId": 6,
              "op": "InsertBefore",
              "parentId": 5,
            },
            {
              "id": 8,
              "op": "CreateElement",
              "type": "wrapper",
            },
            {
              "id": 9,
              "op": "CreateElement",
              "type": "__Card__:__snapshot_a94a8_test_10",
            },
            {
              "id": 9,
              "op": "SetAttributes",
              "values": [
                {
                  "__MTCProps": {
                    "componentInstanceId": 2,
                    "componentTypeId": 2,
                  },
                  "btc": {
                    "$$typeof": "__MTC_SLOT__",
                    "i": 11,
                  },
                  "componentInstanceId": 2,
                  "componentTypeId": 2,
                },
              ],
            },
            {
              "id": 10,
              "op": "CreateElement",
              "type": "wrapper",
            },
            {
              "id": 11,
              "op": "CreateElement",
              "type": "__Card__:__snapshot_a94a8_test_5",
            },
            {
              "id": 12,
              "op": "CreateElement",
              "type": null,
            },
            {
              "dynamicPartIndex": 0,
              "id": 12,
              "op": "SetAttribute",
              "value": "btc Inner",
            },
            {
              "beforeId": null,
              "childId": 12,
              "op": "InsertBefore",
              "parentId": 11,
            },
            {
              "beforeId": null,
              "childId": 11,
              "op": "InsertBefore",
              "parentId": 10,
            },
            {
              "beforeId": null,
              "childId": 10,
              "op": "InsertBefore",
              "parentId": 9,
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
              "parentId": 5,
            },
            {
              "beforeId": null,
              "childId": 5,
              "op": "InsertBefore",
              "parentId": 4,
            },
            {
              "beforeId": null,
              "childId": 4,
              "op": "InsertBefore",
              "parentId": 3,
            },
            {
              "beforeId": null,
              "childId": 3,
              "op": "InsertBefore",
              "parentId": -2,
            },
          ],
        ]
      `);
    }

    // 5. update MTS to show MTC
    {
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      lynx.getNativeApp().callLepusMethod.mockClear();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <mtc-container>
              <view
                component="OuterMTC"
              >
                <text>
                  <raw-text
                    text="OuterMTC"
                  />
                </text>
                <wrapper>
                  <wrapper>
                    <view
                      component="OuterBTC"
                    >
                      <text>
                        <raw-text
                          text="btc Outer"
                        />
                      </text>
                      <wrapper>
                        <mtc-container>
                          <view
                            component="InnerMTC"
                          >
                            <text>
                              <raw-text
                                text="InnerMTC"
                              />
                            </text>
                            <wrapper>
                              <wrapper>
                                <view
                                  component="InnerBTC"
                                >
                                  <text>
                                    <raw-text
                                      text="btc Inner"
                                    />
                                  </text>
                                </view>
                              </wrapper>
                            </wrapper>
                          </view>
                          <wrapper />
                        </mtc-container>
                      </wrapper>
                    </view>
                  </wrapper>
                </wrapper>
              </view>
              <wrapper />
            </mtc-container>
          </view>
        </page>
      `);
    }

    // 6. BTS update BTC
    {
      globalEnvManager.switchToBackground();
      render(<BTC showMTC={true} text={'btc-updated'} />, __root);
      expect(formattedPatch()).toMatchInlineSnapshot(`
        [
          [
            {
              "dynamicPartIndex": 0,
              "id": 3,
              "op": "SetAttribute",
              "value": {
                "__MTCProps": {
                  "componentInstanceId": 1,
                  "componentTypeId": 1,
                },
                "btc": {
                  "$$typeof": "__MTC_SLOT__",
                  "i": 5,
                },
                "componentInstanceId": 1,
                "componentTypeId": 1,
              },
            },
            {
              "dynamicPartIndex": 0,
              "id": 7,
              "op": "SetAttribute",
              "value": "btc-updated Outer",
            },
            {
              "dynamicPartIndex": 0,
              "id": 9,
              "op": "SetAttribute",
              "value": {
                "__MTCProps": {
                  "componentInstanceId": 2,
                  "componentTypeId": 2,
                },
                "btc": {
                  "$$typeof": "__MTC_SLOT__",
                  "i": 11,
                },
                "componentInstanceId": 2,
                "componentTypeId": 2,
              },
            },
            {
              "dynamicPartIndex": 0,
              "id": 12,
              "op": "SetAttribute",
              "value": "btc-updated Inner",
            },
          ],
        ]
      `);
    }

    // 7. MTS update BTC
    {
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      lynx.getNativeApp().callLepusMethod.mockClear();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <mtc-container>
              <view
                component="OuterMTC"
              >
                <text>
                  <raw-text
                    text="OuterMTC"
                  />
                </text>
                <wrapper>
                  <wrapper>
                    <view
                      component="OuterBTC"
                    >
                      <text>
                        <raw-text
                          text="btc-updated Outer"
                        />
                      </text>
                      <wrapper>
                        <mtc-container>
                          <view
                            component="InnerMTC"
                          >
                            <text>
                              <raw-text
                                text="InnerMTC"
                              />
                            </text>
                            <wrapper>
                              <wrapper>
                                <view
                                  component="InnerBTC"
                                >
                                  <text>
                                    <raw-text
                                      text="btc-updated Inner"
                                    />
                                  </text>
                                </view>
                              </wrapper>
                            </wrapper>
                          </view>
                          <wrapper />
                        </mtc-container>
                      </wrapper>
                    </view>
                  </wrapper>
                </wrapper>
              </view>
              <wrapper />
            </mtc-container>
          </view>
        </page>
      `);
    }

    // 8. BTS remove BTC
    {
      globalEnvManager.switchToBackground();
      render(<BTC showMTC={true} text={'btc-updated'} showBTC={false} />, __root);
      expect(formattedPatch()).toMatchInlineSnapshot(`
        [
          [
            {
              "dynamicPartIndex": 0,
              "id": 3,
              "op": "SetAttribute",
              "value": {
                "__MTCProps": {
                  "componentInstanceId": 1,
                  "componentTypeId": 1,
                },
                "btc": null,
                "componentInstanceId": 1,
                "componentTypeId": 1,
              },
            },
            {
              "childId": 4,
              "op": "RemoveChild",
              "parentId": 3,
            },
          ],
        ]
      `);
    }

    // 9. MTS remove BTC
    {
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      lynx.getNativeApp().callLepusMethod.mockClear();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <mtc-container>
              <view
                component="OuterMTC"
              >
                <text>
                  <raw-text
                    text="OuterMTC"
                  />
                </text>
                <wrapper />
              </view>
            </mtc-container>
          </view>
        </page>
      `);
    }

    // 10. check SnapshotInstances
    {
      expect([...snapshotInstanceManager.values.keys()]).toMatchInlineSnapshot(`
        [
          -1,
          -2,
          3,
          -4,
        ]
      `);
    }
  });
});
