import { render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { replaceCommitHook } from '../../src/lifecycle/patch/commit';
import { injectUpdateMainThread } from '../../src/lifecycle/patch/updateMainThread';
import { __root } from '../../src/root';
import { setupPage } from '../../src/snapshot';
import { globalEnvManager } from '../utils/envManager';
import { elementTree } from '../utils/nativeMethod';

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
  injectUpdateMainThread();
  replaceCommitHook();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
  SystemInfo.lynxSdkVersion = '999.999';
});

afterEach(() => {
  vi.restoreAllMocks();
  elementTree.clear();
});

describe('Gesture', () => {
  it('normal gesture', async function() {
    function Comp() {
      const gesture = {
        id: 1,
        type: 0,
        callbacks: {
          onUpdate: {
            _wkltId: 'bdd4:dd564:2',
          },
        },
        __isGesture: true,
        toJSON: () => ({
          ...gesture,
          __isSerialized: true,
        }),
      };

      return (
        <view>
          <text main-thread:gesture={gesture}>1</text>
        </view>
      );
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="1"
              />
            </text>
          </view>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }

    {
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text
              flatten={false}
              gesture={
                {
                  "config": {
                    "callbacks": [
                      {
                        "callback": {
                          "_execId": 1,
                          "_wkltId": "bdd4:dd564:2",
                        },
                        "name": "onUpdate",
                      },
                    ],
                  },
                  "id": 1,
                  "relationMap": {
                    "continueWith": [],
                    "simultaneous": [],
                    "waitFor": [],
                  },
                  "type": 0,
                }
              }
              has-react-gesture={true}
            >
              <raw-text
                text="1"
              />
            </text>
          </view>
        </page>
      `);
    }
  });
  it('composed gesture', async function() {
    function Comp() {
      const panGesture = {
        id: 1,
        type: 0,
        callbacks: {
          onUpdate: {
            _wkltId: 'bdd4:dd564:2',
          },
        },
        simultaneousWith: [{ id: 2 }],
        continueWith: [{ id: 2 }],
        __isGesture: true,
        toJSON: () => ({
          ...panGesture,
          __isSerialized: true,
        }),
      };
      const tapGesture = {
        id: 2,
        type: 2,
        callbacks: {
          onUpdate: {
            _wkltId: 'bdd4:dd564:2',
          },
        },
        __isGesture: true,
        waitFor: [{ id: 1 }],
        toJSON: () => ({
          ...tapGesture,
          __isSerialized: true,
        }),
      };

      const gesture = {
        type: -1,
        __isGesture: true,
        gestures: [panGesture, tapGesture],
        toJSON: () => ({
          ...gesture,
          __isSerialized: true,
        }),
      };

      return (
        <view>
          <text main-thread:gesture={gesture}>1</text>
        </view>
      );
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="1"
              />
            </text>
          </view>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }

    // Real main thread render
    {
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text
              flatten={false}
              gesture={
                {
                  "config": {
                    "callbacks": [
                      {
                        "callback": {
                          "_execId": 3,
                          "_wkltId": "bdd4:dd564:2",
                        },
                        "name": "onUpdate",
                      },
                    ],
                  },
                  "id": 2,
                  "relationMap": {
                    "continueWith": [],
                    "simultaneous": [],
                    "waitFor": [
                      1,
                    ],
                  },
                  "type": 2,
                }
              }
              has-react-gesture={true}
            >
              <raw-text
                text="1"
              />
            </text>
          </view>
        </page>
      `);
    }
  });
  it('update gesture', async function() {
    let _gesture,
      id = 1;
    function Comp() {
      _gesture = {
        id: id++,
        type: 0,
        callbacks: {
          onUpdate: {
            _wkltId: 'bdd4:dd564:2',
          },
        },
        __isGesture: true,
        toJSON() {
          const { toJSON, ...rest } = this;
          return {
            ...rest,
            __isSerialized: true,
          };
        },
      };
      return (
        <view>
          <text main-thread:gesture={_gesture}>1</text>
        </view>
      );
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
    }

    // background render
    {
      _gesture = { ..._gesture };
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);

      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text
              flatten={false}
              gesture={
                {
                  "config": {
                    "callbacks": [
                      {
                        "callback": {
                          "_execId": 4,
                          "_wkltId": "bdd4:dd564:2",
                        },
                        "name": "onUpdate",
                      },
                    ],
                  },
                  "id": 2,
                  "relationMap": {
                    "continueWith": [],
                    "simultaneous": [],
                    "waitFor": [],
                  },
                  "type": 0,
                }
              }
              has-react-gesture={true}
            >
              <raw-text
                text="1"
              />
            </text>
          </view>
        </page>
      `);
    }
    // update
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();

      render(<Comp />, __root);

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);

      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text
              flatten={false}
              gesture={
                {
                  "config": {
                    "callbacks": [
                      {
                        "callback": {
                          "_execId": 5,
                          "_wkltId": "bdd4:dd564:2",
                        },
                        "name": "onUpdate",
                      },
                    ],
                  },
                  "id": 3,
                  "relationMap": {
                    "continueWith": [],
                    "simultaneous": [],
                    "waitFor": [],
                  },
                  "type": 0,
                }
              }
              has-react-gesture={true}
            >
              <raw-text
                text="1"
              />
            </text>
          </view>
        </page>
      `);
    }
  });
  it('insert gesture', async function() {
    let patch;
    let INIT_GESTURE = {
      id: 1,
      type: 0,
      callbacks: {
        onUpdate: {
          _wkltId: 'bdd4:dd564:2',
        },
      },
      __isGesture: true,
      toJSON() {
        const { toJSON, ...rest } = this;
        return {
          ...rest,
          __isSerialized: true,
        };
      },
    };
    let _gesture2 = undefined;
    let hasGesture = false;
    function Comp() {
      return <view>{hasGesture ? <text main-thread:gesture={_gesture2}>1</text> : <text>1</text>}</view>;
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="1"
              />
            </text>
          </view>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
    }

    {
      expect(__root.__element_root).toMatchInlineSnapshot(`undefined`);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }
    // insert
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();

      _gesture2 = {
        ...INIT_GESTURE,
        id: 2,
      };
      hasGesture = true;

      lynx.getNativeApp().callLepusMethod.mockClear();
      render(<Comp />, __root);

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);

      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text
              flatten={false}
              gesture={
                {
                  "config": {
                    "callbacks": [
                      {
                        "callback": {
                          "_execId": 6,
                          "_wkltId": "bdd4:dd564:2",
                        },
                        "name": "onUpdate",
                      },
                    ],
                  },
                  "id": 2,
                  "relationMap": {
                    "continueWith": [],
                    "simultaneous": [],
                    "waitFor": [],
                  },
                  "type": 0,
                }
              }
              has-react-gesture={true}
            >
              <raw-text
                text="1"
              />
            </text>
          </view>
        </page>
      `);
    }
  });
  it('gesture with config', async function() {
    function Comp() {
      const gesture = {
        id: 1,
        type: 0,
        callbacks: {
          onUpdate: {
            _wkltId: 'bdd4:dd564:2',
          },
        },
        config: {
          minDistance: 100,
        },
        __isGesture: true,
        toJSON: () => ({
          ...gesture,
          __isSerialized: true,
        }),
      };

      return (
        <view>
          <text main-thread:gesture={gesture}>1</text>
        </view>
      );
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="1"
              />
            </text>
          </view>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }

    {
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text
              flatten={false}
              gesture={
                {
                  "config": {
                    "callbacks": [
                      {
                        "callback": {
                          "_execId": 7,
                          "_wkltId": "bdd4:dd564:2",
                        },
                        "name": "onUpdate",
                      },
                    ],
                    "config": {
                      "minDistance": 100,
                    },
                  },
                  "id": 1,
                  "relationMap": {
                    "continueWith": [],
                    "simultaneous": [],
                    "waitFor": [],
                  },
                  "type": 0,
                }
              }
              has-react-gesture={true}
            >
              <raw-text
                text="1"
              />
            </text>
          </view>
        </page>
      `);
    }
  });
});

describe('Gesture in spread', () => {
  it('normal gesture', async function() {
    function Comp() {
      const gesture = {
        id: 1,
        type: 0,
        callbacks: {
          onUpdate: {
            _wkltId: 'bdd4:dd564:2',
          },
        },
        __isGesture: true,
        toJSON: () => ({
          ...gesture,
          __isSerialized: true,
        }),
      };

      const props = {
        'main-thread:gesture': gesture,
      };

      return (
        <view>
          <text {...props}>1</text>
        </view>
      );
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="1"
              />
            </text>
          </view>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }

    // Main Thread Render
    {
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text
              flatten={false}
              gesture={
                {
                  "config": {
                    "callbacks": [
                      {
                        "callback": {
                          "_execId": 8,
                          "_wkltId": "bdd4:dd564:2",
                        },
                        "name": "onUpdate",
                      },
                    ],
                  },
                  "id": 1,
                  "relationMap": {
                    "continueWith": [],
                    "simultaneous": [],
                    "waitFor": [],
                  },
                  "type": 0,
                }
              }
              has-react-gesture={true}
            >
              <raw-text
                text="1"
              />
            </text>
          </view>
        </page>
      `);
    }
  });
  it('update gesture', async function() {
    let _gesture = {
      id: 1,
      type: 0,
      callbacks: {
        onUpdate: {
          _wkltId: 'bdd4:dd564:2',
        },
      },
      __isGesture: true,
      toJSON() {
        const { toJSON, ...rest } = this;
        return {
          ...rest,
          __isSerialized: true,
        };
      },
    };
    function Comp() {
      const props = {
        'main-thread:gesture': _gesture,
      };
      return (
        <view>
          <text {...props}>1</text>
        </view>
      );
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="1"
              />
            </text>
          </view>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }
    // update
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();

      _gesture = {
        ..._gesture,
        id: 2,
      };

      render(<Comp />, __root);

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);

      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text
              flatten={false}
              gesture={
                {
                  "config": {
                    "callbacks": [
                      {
                        "callback": {
                          "_execId": 10,
                          "_wkltId": "bdd4:dd564:2",
                        },
                        "name": "onUpdate",
                      },
                    ],
                  },
                  "id": 2,
                  "relationMap": {
                    "continueWith": [],
                    "simultaneous": [],
                    "waitFor": [],
                  },
                  "type": 0,
                }
              }
              has-react-gesture={true}
            >
              <raw-text
                text="1"
              />
            </text>
          </view>
        </page>
      `);
    }
  });
  it('insert gesture', async function() {
    let INIT_GESTURE = {
      id: 1,
      type: 0,
      callbacks: {
        onUpdate: {
          _wkltId: 'bdd4:dd564:2',
        },
      },
      __isGesture: true,
      toJSON() {
        const { toJSON, ...rest } = this;
        return {
          ...rest,
          __isSerialized: true,
        };
      },
    };
    let _gesture2 = undefined;
    let hasGesture = false;
    function Comp() {
      const props = {
        'main-thread:gesture': _gesture2,
      };
      return <view>{hasGesture ? <text {...props}>1</text> : <text>1</text>}</view>;
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="1"
              />
            </text>
          </view>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
    }

    {
      expect(__root.__element_root).toMatchInlineSnapshot(`undefined`);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }
    // insert
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();

      _gesture2 = {
        ...INIT_GESTURE,
        id: 2,
      };
      hasGesture = true;

      lynx.getNativeApp().callLepusMethod.mockClear();
      render(<Comp />, __root);

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);

      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text
              flatten={false}
              gesture={
                {
                  "config": {
                    "callbacks": [
                      {
                        "callback": {
                          "_execId": 11,
                          "_wkltId": "bdd4:dd564:2",
                        },
                        "name": "onUpdate",
                      },
                    ],
                  },
                  "id": 2,
                  "relationMap": {
                    "continueWith": [],
                    "simultaneous": [],
                    "waitFor": [],
                  },
                  "type": 0,
                }
              }
              has-react-gesture={true}
            >
              <raw-text
                text="1"
              />
            </text>
          </view>
        </page>
      `);
    }
  });
  it('remove gesture', async function() {
    let _gesture = {
      id: 1,
      type: 0,
      callbacks: {
        onUpdate: {
          _wkltId: 'bdd4:dd564:2',
        },
      },
      __isGesture: true,
      toJSON() {
        const { toJSON, ...rest } = this;
        return {
          ...rest,
          __isSerialized: true,
        };
      },
    };
    function Comp() {
      const props = {
        'main-thread:gesture': _gesture,
      };
      return (
        <view>
          <text {...props}>1</text>
        </view>
      );
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="1"
              />
            </text>
          </view>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }
    // update
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();

      _gesture = undefined;

      render(<Comp />, __root);

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);

      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="1"
              />
            </text>
          </view>
        </page>
      `);
    }
  });
});

describe('Gesture Error', () => {
  it('Invalid gesture', async function() {
    function Comp() {
      const gesture = {
        __isGesture: true,
      };

      return (
        <view>
          <text main-thread:gesture={gesture}>1</text>
        </view>
      );
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="1"
              />
            </text>
          </view>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
    }
  });
});
