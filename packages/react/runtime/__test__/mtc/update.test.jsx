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
  it('should insert, update and remove new MTC when updating', () => {
    const MTC = ({ mtcText }) => {
      return (
        <view>
          <text>{mtcText}</text>
        </view>
      );
    };

    const FakeMTC = ({ key, text }) => {
      return (
        <mtc-container
          props={{
            __MTCProps: {
              componentInstanceId: 1,
              componentTypeId: 1,
            },
            mtcText: text,
          }}
        >
        </mtc-container>
      );
    };

    const BTC = ({ showMTC = false, mtcText = 'mtc' }) => {
      return (
        <view>
          <view>
            <text>btc</text>
          </view>
          {showMTC ? <FakeMTC text={mtcText} /> : null}
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
          <view>
            <view>
              <text>
                <raw-text
                  text="btc"
                />
              </text>
            </view>
            <wrapper />
          </view>
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
      render(<BTC showMTC={true} />, __root);
      expect(formattedPatch()).toMatchInlineSnapshot(`
        [
          [
            {
              "id": 3,
              "op": "CreateElement",
              "type": "__Card__:__snapshot_a94a8_test_2",
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
                  "mtcText": "mtc",
                },
              ],
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
            <view>
              <text>
                <raw-text
                  text="btc"
                />
              </text>
            </view>
            <wrapper>
              <mtc-container>
                <view>
                  <text>
                    <raw-text
                      text="mtc"
                    />
                  </text>
                </view>
              </mtc-container>
            </wrapper>
          </view>
        </page>
      `);
    }

    // 6. BTS update MTC props
    {
      globalEnvManager.switchToBackground();
      render(<BTC showMTC={true} mtcText='mtc-updated' />, __root);
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
                "mtcText": "mtc-updated",
              },
            },
          ],
        ]
      `);
    }

    // 7. MTS update MTC
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
            <view>
              <text>
                <raw-text
                  text="btc"
                />
              </text>
            </view>
            <wrapper>
              <mtc-container>
                <view>
                  <text>
                    <raw-text
                      text="mtc-updated"
                    />
                  </text>
                </view>
              </mtc-container>
            </wrapper>
          </view>
        </page>
      `);
    }

    // 8. BTS Remove MTC
    {
      globalEnvManager.switchToBackground();
      render(<BTC showMTC={false} />, __root);
      expect(formattedPatch()).toMatchInlineSnapshot(`
        [
          [
            {
              "childId": 3,
              "op": "RemoveChild",
              "parentId": -2,
            },
          ],
        ]
      `);
    }

    // 9. MTS Remove MTC
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
            <view>
              <text>
                <raw-text
                  text="btc"
                />
              </text>
            </view>
            <wrapper />
          </view>
        </page>
      `);
    }

    // 10. Check saved VNodes
    {
      expect(mtcComponentVNodes.size).toBe(0);
    }
  });

  it('should insert, update and remove multiple new MTCs when updating', () => {
    const MTC = ({ mtcText }) => {
      return (
        <view>
          <text>{mtcText}</text>
        </view>
      );
    };

    const FakeMTC = ({ key, text, componentInstanceId }) => {
      return (
        <mtc-container
          props={{
            __MTCProps: {
              componentInstanceId,
              componentTypeId: 1,
            },
            mtcText: text,
          }}
        >
        </mtc-container>
      );
    };

    const BTC = ({ showMTC1 = false, showMTC2 = false, mtcText1, mtcText2 }) => {
      return (
        <view>
          <view>
            <text>btc</text>
          </view>
          {showMTC1 ? <FakeMTC text={mtcText1} componentInstanceId={1} /> : null}
          {showMTC2 ? <FakeMTC text={mtcText2} componentInstanceId={2} /> : null}
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
          <view>
            <view>
              <text>
                <raw-text
                  text="btc"
                />
              </text>
            </view>
            <wrapper />
          </view>
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

    // 4. BTS render MTC2
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      render(<BTC showMTC2={true} mtcText2={'mtc2'} />, __root);
      expect(formattedPatch()).toMatchInlineSnapshot(`
        [
          [
            {
              "id": 3,
              "op": "CreateElement",
              "type": "__Card__:__snapshot_a94a8_test_5",
            },
            {
              "id": 3,
              "op": "SetAttributes",
              "values": [
                {
                  "__MTCProps": {
                    "componentInstanceId": 2,
                    "componentTypeId": 1,
                  },
                  "mtcText": "mtc2",
                },
              ],
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

    // 5. update MTS to show MTC2
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
            <view>
              <text>
                <raw-text
                  text="btc"
                />
              </text>
            </view>
            <wrapper>
              <mtc-container>
                <view>
                  <text>
                    <raw-text
                      text="mtc2"
                    />
                  </text>
                </view>
              </mtc-container>
            </wrapper>
          </view>
        </page>
      `);
    }

    // 6. BTS insert MTC1
    {
      globalEnvManager.switchToBackground();
      render(<BTC showMTC1={true} showMTC2={true} mtcText1={'mtc1'} mtcText2={'mtc2'} />, __root);
      expect(formattedPatch()).toMatchInlineSnapshot(`
        [
          [
            {
              "id": 4,
              "op": "CreateElement",
              "type": "__Card__:__snapshot_a94a8_test_5",
            },
            {
              "id": 4,
              "op": "SetAttributes",
              "values": [
                {
                  "__MTCProps": {
                    "componentInstanceId": 1,
                    "componentTypeId": 1,
                  },
                  "mtcText": "mtc1",
                },
              ],
            },
            {
              "beforeId": 3,
              "childId": 4,
              "op": "InsertBefore",
              "parentId": -2,
            },
          ],
        ]
      `);
    }

    // 7. MTS insert MTC1
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
            <view>
              <text>
                <raw-text
                  text="btc"
                />
              </text>
            </view>
            <wrapper>
              <mtc-container>
                <view>
                  <text>
                    <raw-text
                      text="mtc1"
                    />
                  </text>
                </view>
              </mtc-container>
              <mtc-container>
                <view>
                  <text>
                    <raw-text
                      text="mtc2"
                    />
                  </text>
                </view>
              </mtc-container>
            </wrapper>
          </view>
        </page>
      `);
    }

    // 8. BTS update MTC2 props
    {
      globalEnvManager.switchToBackground();
      render(<BTC showMTC1={true} showMTC2={true} mtcText1={'mtc1'} mtcText2={'mtc2-updated'} />, __root);
      expect(formattedPatch()).toMatchInlineSnapshot(`
        [
          [
            {
              "dynamicPartIndex": 0,
              "id": 3,
              "op": "SetAttribute",
              "value": {
                "__MTCProps": {
                  "componentInstanceId": 2,
                  "componentTypeId": 1,
                },
                "mtcText": "mtc2-updated",
              },
            },
          ],
        ]
      `);
    }

    // 9. MTS update MTC2 props
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
            <view>
              <text>
                <raw-text
                  text="btc"
                />
              </text>
            </view>
            <wrapper>
              <mtc-container>
                <view>
                  <text>
                    <raw-text
                      text="mtc1"
                    />
                  </text>
                </view>
              </mtc-container>
              <mtc-container>
                <view>
                  <text>
                    <raw-text
                      text="mtc2-updated"
                    />
                  </text>
                </view>
              </mtc-container>
            </wrapper>
          </view>
        </page>
      `);
    }

    // 10. BTS update MTC1 props
    {
      globalEnvManager.switchToBackground();
      render(<BTC showMTC1={true} showMTC2={true} mtcText1={'mtc1-updated'} mtcText2={'mtc2-updated'} />, __root);
      expect(formattedPatch()).toMatchInlineSnapshot(`
        [
          [
            {
              "dynamicPartIndex": 0,
              "id": 4,
              "op": "SetAttribute",
              "value": {
                "__MTCProps": {
                  "componentInstanceId": 1,
                  "componentTypeId": 1,
                },
                "mtcText": "mtc1-updated",
              },
            },
          ],
        ]
      `);
    }

    // 11. MTS update MTC1 props
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
            <view>
              <text>
                <raw-text
                  text="btc"
                />
              </text>
            </view>
            <wrapper>
              <mtc-container>
                <view>
                  <text>
                    <raw-text
                      text="mtc1-updated"
                    />
                  </text>
                </view>
              </mtc-container>
              <mtc-container>
                <view>
                  <text>
                    <raw-text
                      text="mtc2-updated"
                    />
                  </text>
                </view>
              </mtc-container>
            </wrapper>
          </view>
        </page>
      `);
    }

    // 12. BTS remove MTC1
    {
      globalEnvManager.switchToBackground();
      render(<BTC showMTC2={true} mtcText2={'mtc2-updated'} />, __root);
      expect(formattedPatch()).toMatchInlineSnapshot(`
        [
          [
            {
              "childId": 4,
              "op": "RemoveChild",
              "parentId": -2,
            },
          ],
        ]
      `);
    }

    // 13. MTS remove MTC1
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
            <view>
              <text>
                <raw-text
                  text="btc"
                />
              </text>
            </view>
            <wrapper>
              <mtc-container>
                <view>
                  <text>
                    <raw-text
                      text="mtc2-updated"
                    />
                  </text>
                </view>
              </mtc-container>
            </wrapper>
          </view>
        </page>
      `);
    }

    // 14. BTS remove MTC2
    {
      globalEnvManager.switchToBackground();
      render(<BTC />, __root);
      expect(formattedPatch()).toMatchInlineSnapshot(`
        [
          [
            {
              "childId": 3,
              "op": "RemoveChild",
              "parentId": -2,
            },
          ],
        ]
      `);
    }

    // 15. MTS remove MTC2
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
            <view>
              <text>
                <raw-text
                  text="btc"
                />
              </text>
            </view>
            <wrapper />
          </view>
        </page>
      `);
    }

    // 16. Check saved VNodes
    {
      expect(mtcComponentVNodes.size).toBe(0);
    }
  });

  it('should be able to update MTC into a new type when updating', () => {
    const MTC1 = ({ mtcText }) => {
      return (
        <view>
          <text>{mtcText}</text>
        </view>
      );
    };

    const MTC2 = ({ mtcText }) => {
      return (
        <view>
          <view attr={mtcText}></view>
        </view>
      );
    };

    const FakeMTC1 = ({ key, text }) => {
      return (
        <mtc-container
          props={{
            __MTCProps: {
              componentInstanceId: 1,
              componentTypeId: 1,
            },
            mtcText: text,
          }}
        >
        </mtc-container>
      );
    };

    const FakeMTC2 = ({ key, text }) => {
      return (
        <mtc-container
          props={{
            __MTCProps: {
              componentInstanceId: 2,
              componentTypeId: 2,
            },
            mtcText: text,
          }}
        >
        </mtc-container>
      );
    };

    const BTC = ({ showMTC = 0, mtcText1, mtcText2 }) => {
      return (
        <view>
          <view>
            <text>btc</text>
          </view>
          {showMTC === 0 ? null : (showMTC === 1 ? <FakeMTC1 text={mtcText1} /> : <FakeMTC2 text={mtcText2} />)}
        </view>
      );
    };

    mtcComponentTypes.set(1, MTC1);
    mtcComponentTypes.set(2, MTC2);

    // 1. render MTS without MTC
    {
      __root.__jsx = <BTC />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <view>
              <text>
                <raw-text
                  text="btc"
                />
              </text>
            </view>
            <wrapper />
          </view>
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
      render(<BTC showMTC={1} mtcText1={'mtc1'} />, __root);
      expect(formattedPatch()).toMatchInlineSnapshot(`
        [
          [
            {
              "id": 3,
              "op": "CreateElement",
              "type": "__Card__:__snapshot_a94a8_test_9",
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
                  "mtcText": "mtc1",
                },
              ],
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
            <view>
              <text>
                <raw-text
                  text="btc"
                />
              </text>
            </view>
            <wrapper>
              <mtc-container>
                <view>
                  <text>
                    <raw-text
                      text="mtc1"
                    />
                  </text>
                </view>
              </mtc-container>
            </wrapper>
          </view>
        </page>
      `);
    }

    // 6. BTS update MTC props
    {
      globalEnvManager.switchToBackground();
      render(<BTC showMTC={2} mtcText2='mtc2' />, __root);
      expect(formattedPatch()).toMatchInlineSnapshot(`
        [
          [
            {
              "childId": 3,
              "op": "RemoveChild",
              "parentId": -2,
            },
            {
              "id": 4,
              "op": "CreateElement",
              "type": "__Card__:__snapshot_a94a8_test_10",
            },
            {
              "id": 4,
              "op": "SetAttributes",
              "values": [
                {
                  "__MTCProps": {
                    "componentInstanceId": 2,
                    "componentTypeId": 2,
                  },
                  "mtcText": "mtc2",
                },
              ],
            },
            {
              "beforeId": null,
              "childId": 4,
              "op": "InsertBefore",
              "parentId": -2,
            },
          ],
        ]
      `);
    }

    // 7. MTS update MTC
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
            <view>
              <text>
                <raw-text
                  text="btc"
                />
              </text>
            </view>
            <wrapper>
              <mtc-container>
                <view>
                  <view
                    attr="mtc2"
                  />
                </view>
              </mtc-container>
            </wrapper>
          </view>
        </page>
      `);
    }

    // 8. BTS Remove MTC
    {
      globalEnvManager.switchToBackground();
      render(<BTC showMTC={0} />, __root);
      expect(formattedPatch()).toMatchInlineSnapshot(`
        [
          [
            {
              "childId": 4,
              "op": "RemoveChild",
              "parentId": -2,
            },
          ],
        ]
      `);
    }

    // 9. MTS Remove MTC
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
            <view>
              <text>
                <raw-text
                  text="btc"
                />
              </text>
            </view>
            <wrapper />
          </view>
        </page>
      `);
    }

    // 10. Check saved VNodes
    {
      expect(mtcComponentVNodes.size).toBe(0);
    }
  });

  it.skip('should insert, update and remove multiple new different types of MTCs when updating', () => {
    const MTC = ({ mtcText }) => {
      return (
        <view>
          <text>
            <raw-text
              text={mtcText}
            />
          </text>
        </view>
      );
    };
  });
});
