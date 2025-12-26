// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { BackgroundSnapshotInstance } from '../src/backgroundSnapshot';
import { globalEnvManager } from './utils/envManager';
import { elementTree } from './utils/nativeMethod';
import { registerWorkletOnBackground } from '../src/internal';
import { addCtxNotFoundEventListener } from '../src/lifecycle/patch/error';
import {
  SnapshotOperation,
  __globalSnapshotPatch,
  deinitGlobalSnapshotPatch,
  initGlobalSnapshotPatch,
  takeGlobalSnapshotPatch,
} from '../src/lifecycle/patch/snapshotPatch';
import { snapshotPatchApply } from '../src/lifecycle/patch/snapshotPatchApply';
import {
  SnapshotInstance,
  createSnapshot,
  snapshotCreatorMap,
  snapshotInstanceManager,
  snapshotManager,
} from '../src/snapshot';
import { DynamicPartType } from '../src/snapshot/dynamicPartType';

const HOLE = null;

beforeAll(() => {
  globalEnvManager.resetEnv();
  globalEnvManager.switchToBackground();
  addCtxNotFoundEventListener();
  globalEnvManager.switchToMainThread();
  globalThis.createSnapshot = createSnapshot;
  globalThis.DynamicPartType = DynamicPartType;
});

beforeEach(() => {
  globalEnvManager.resetEnv();
});

afterEach(() => {
  elementTree.clear();
  vi.clearAllMocks();
});

const snapshot1 = __SNAPSHOT__(
  <view>
    <text>snapshot1</text>
    <view>{HOLE}</view>
  </view>,
);

const snapshot2 = __SNAPSHOT__(
  <view>
    <text>snapshot2</text>
  </view>,
);

const snapshot3 = __SNAPSHOT__(
  <view>
    <text>snapshot3</text>
  </view>,
);

const snapshot4 = __SNAPSHOT__(
  <view>
    <text text={HOLE}></text>
    <text text={HOLE}></text>
  </view>,
);

const snapshot5 = __SNAPSHOT__(
  <list className={HOLE}></list>,
);

describe('SnapshotPatch', () => {
  it('before init', async function() {
    const patch = takeGlobalSnapshotPatch();
    expect(patch).toMatchInlineSnapshot(`undefined`);
  });
});

describe('createElement', () => {
  beforeEach(() => {
    initGlobalSnapshotPatch();
  });

  it('basic', async function() {
    const bsi1 = new BackgroundSnapshotInstance(snapshot1);
    const bsi2 = new BackgroundSnapshotInstance(snapshot2);
    const patch = takeGlobalSnapshotPatch();
    expect(patch).toMatchInlineSnapshot(`
      [
        0,
        "__snapshot_a94a8_test_1",
        2,
        0,
        "__snapshot_a94a8_test_2",
        3,
      ]
    `);

    expect(snapshotInstanceManager.values.size).toEqual(1);
    snapshotPatchApply(patch);
    expect(snapshotInstanceManager.values.size).toEqual(3);
    const si1 = snapshotInstanceManager.values.get(bsi1.__id);
    si1.ensureElements();
    expect(si1.__element_root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="snapshot1"
          />
        </text>
        <view />
      </view>
    `);
    const si2 = snapshotInstanceManager.values.get(bsi2.__id);
    si2.ensureElements();
    expect(si2.__element_root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="snapshot2"
          />
        </text>
      </view>
    `);
  });
});

describe('insertBefore', () => {
  beforeEach(() => {
    initGlobalSnapshotPatch();
  });

  it('basic', async function() {
    const bsi1 = new BackgroundSnapshotInstance(snapshot1);
    const bsi2 = new BackgroundSnapshotInstance(snapshot2);
    bsi1.insertBefore(bsi2);
    const patch = takeGlobalSnapshotPatch();
    expect(patch).toMatchInlineSnapshot(`
      [
        0,
        "__snapshot_a94a8_test_1",
        2,
        0,
        "__snapshot_a94a8_test_2",
        3,
        1,
        2,
        3,
        undefined,
      ]
    `);

    expect(snapshotInstanceManager.values.size).toEqual(1);
    snapshotPatchApply(patch);
    expect(snapshotInstanceManager.values.size).toEqual(3);
    const si1 = snapshotInstanceManager.values.get(bsi1.__id);
    si1.ensureElements();
    expect(si1.__element_root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="snapshot1"
          />
        </text>
        <view>
          <view>
            <text>
              <raw-text
                text="snapshot2"
              />
            </text>
          </view>
        </view>
      </view>
    `);
  });

  it('insert in the middle', async function() {
    const bsi1 = new BackgroundSnapshotInstance(snapshot1);
    const bsi2 = new BackgroundSnapshotInstance(snapshot2);
    const bsi3 = new BackgroundSnapshotInstance(snapshot3);
    bsi1.insertBefore(bsi3);
    bsi1.insertBefore(bsi2, bsi3);
    const patch = takeGlobalSnapshotPatch();
    expect(patch).toMatchInlineSnapshot(`
      [
        0,
        "__snapshot_a94a8_test_1",
        2,
        0,
        "__snapshot_a94a8_test_2",
        3,
        0,
        "__snapshot_a94a8_test_3",
        4,
        1,
        2,
        4,
        undefined,
        1,
        2,
        3,
        4,
      ]
    `);

    expect(snapshotInstanceManager.values.size).toEqual(1);
    snapshotPatchApply(patch);
    expect(snapshotInstanceManager.values.size).toEqual(4);
    const si1 = snapshotInstanceManager.values.get(bsi1.__id);
    si1.ensureElements();
    expect(si1.__element_root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="snapshot1"
          />
        </text>
        <view>
          <view>
            <text>
              <raw-text
                text="snapshot2"
              />
            </text>
          </view>
          <view>
            <text>
              <raw-text
                text="snapshot3"
              />
            </text>
          </view>
        </view>
      </view>
    `);
  });

  it('error', async function() {
    const bsi1 = new BackgroundSnapshotInstance(snapshot1);
    const bsi2 = new BackgroundSnapshotInstance(snapshot2);
    const patch = takeGlobalSnapshotPatch();
    const bsi3 = new BackgroundSnapshotInstance(snapshot3);
    patch.push(
      SnapshotOperation.InsertBefore,
      2,
      100,
      null,
      SnapshotOperation.InsertBefore,
      100,
      2,
      null,
      SnapshotOperation.InsertBefore,
      4,
      100,
      null,
    );
    expect(patch).toMatchInlineSnapshot(`
      [
        0,
        "__snapshot_a94a8_test_1",
        2,
        0,
        "__snapshot_a94a8_test_2",
        3,
        1,
        2,
        100,
        null,
        1,
        100,
        2,
        null,
        1,
        4,
        100,
        null,
      ]
    `);

    expect(snapshotInstanceManager.values.size).toEqual(1);
    snapshotPatchApply(patch);
    expect(_ReportError.mock.calls).toMatchInlineSnapshot(`
      [
        [
          [Error: snapshotPatchApply failed: ctx not found, snapshot type: 'null'],
          {
            "errorCode": 1101,
          },
        ],
        [
          [Error: snapshotPatchApply failed: ctx not found, snapshot type: 'null'],
          {
            "errorCode": 1101,
          },
        ],
        [
          [Error: snapshotPatchApply failed: ctx not found, snapshot type: '__snapshot_a94a8_test_3'],
          {
            "errorCode": 1101,
          },
        ],
      ]
    `);

    expect(snapshotInstanceManager.values.size).toEqual(3);
    const si1 = snapshotInstanceManager.values.get(bsi1.__id);
    si1.ensureElements();
    expect(si1.__element_root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="snapshot1"
          />
        </text>
        <view />
      </view>
    `);
  });
});

describe('removeChild', () => {
  beforeEach(() => {
    initGlobalSnapshotPatch();
  });

  it('basic', async function() {
    const bsi1 = new BackgroundSnapshotInstance(snapshot1);
    const bsi2 = new BackgroundSnapshotInstance(snapshot2);
    bsi1.insertBefore(bsi2);
    let patch = takeGlobalSnapshotPatch();
    snapshotPatchApply(patch);

    const si1 = snapshotInstanceManager.values.get(bsi1.__id);
    si1.ensureElements();
    expect(si1.__element_root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="snapshot1"
          />
        </text>
        <view>
          <view>
            <text>
              <raw-text
                text="snapshot2"
              />
            </text>
          </view>
        </view>
      </view>
    `);

    bsi1.removeChild(bsi2);
    patch = takeGlobalSnapshotPatch();
    expect(patch).toMatchInlineSnapshot(`
      [
        2,
        2,
        3,
      ]
    `);
    snapshotPatchApply(patch);
    expect(si1.__element_root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="snapshot1"
          />
        </text>
        <view />
      </view>
    `);
  });

  it('basic 2', async function() {
    const bsi1 = new BackgroundSnapshotInstance(snapshot1);
    const bsi2 = new BackgroundSnapshotInstance(snapshot2);
    const bsi3 = new BackgroundSnapshotInstance(snapshot3);
    bsi1.insertBefore(bsi2);
    bsi1.insertBefore(bsi3);
    let patch = takeGlobalSnapshotPatch();
    snapshotPatchApply(patch);

    const si1 = snapshotInstanceManager.values.get(bsi1.__id);
    si1.ensureElements();
    expect(si1.__element_root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="snapshot1"
          />
        </text>
        <view>
          <view>
            <text>
              <raw-text
                text="snapshot2"
              />
            </text>
          </view>
          <view>
            <text>
              <raw-text
                text="snapshot3"
              />
            </text>
          </view>
        </view>
      </view>
    `);

    bsi1.removeChild(bsi2);
    patch = takeGlobalSnapshotPatch();
    expect(patch).toMatchInlineSnapshot(`
      [
        2,
        2,
        3,
      ]
    `);
    snapshotPatchApply(patch);
    expect(si1.__element_root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="snapshot1"
          />
        </text>
        <view>
          <view>
            <text>
              <raw-text
                text="snapshot3"
              />
            </text>
          </view>
        </view>
      </view>
    `);

    patch = takeGlobalSnapshotPatch();
    patch.push(SnapshotOperation.RemoveChild, 1, 2, SnapshotOperation.RemoveChild, 2, 1);
    expect(patch).toMatchInlineSnapshot(`
      [
        2,
        1,
        2,
        2,
        2,
        1,
      ]
    `);
    snapshotPatchApply(patch);
    expect(_ReportError).toHaveBeenCalledTimes(2);

    expect(_ReportError.mock.calls).toMatchInlineSnapshot(`
      [
        [
          [Error: snapshotPatchApply failed: ctx not found, snapshot type: 'root'],
          {
            "errorCode": 1101,
          },
        ],
        [
          [Error: snapshotPatchApply failed: ctx not found, snapshot type: 'root'],
          {
            "errorCode": 1101,
          },
        ],
      ]
    `);
    expect(si1.__element_root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="snapshot1"
          />
        </text>
        <view>
          <view>
            <text>
              <raw-text
                text="snapshot3"
              />
            </text>
          </view>
        </view>
      </view>
    `);

    bsi1.removeChild(bsi3);
    patch = takeGlobalSnapshotPatch();
    expect(patch).toMatchInlineSnapshot(`
      [
        2,
        2,
        4,
      ]
    `);
    snapshotPatchApply(patch);
    expect(si1.__element_root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="snapshot1"
          />
        </text>
        <view />
      </view>
    `);
  });
});

describe('setAttribute', () => {
  beforeEach(() => {
    initGlobalSnapshotPatch();
  });

  it('basic', async function() {
    const bsi1 = new BackgroundSnapshotInstance(snapshot4);
    bsi1.setAttribute(0, 'attr 1');
    bsi1.setAttribute(1, 'attr 2');
    const patch = takeGlobalSnapshotPatch();
    expect(patch).toMatchInlineSnapshot(`
      [
        0,
        "__snapshot_a94a8_test_4",
        2,
        3,
        2,
        0,
        "attr 1",
        3,
        2,
        1,
        "attr 2",
      ]
    `);

    expect(snapshotInstanceManager.values.size).toEqual(1);
    snapshotPatchApply(patch);
    const si1 = snapshotInstanceManager.values.get(bsi1.__id);
    si1.ensureElements();
    expect(si1.__element_root).toMatchInlineSnapshot(`
        <view>
          <text
            text="attr 1"
          />
          <text
            text="attr 2"
          />
        </view>
      `);
  });

  it('basic - setAttributes', async function() {
    const bsi1 = new BackgroundSnapshotInstance(snapshot4);
    bsi1.setAttribute('values', ['attr 1', 'attr 2']);
    const patch = takeGlobalSnapshotPatch();
    expect(patch).toMatchInlineSnapshot(`
      [
        0,
        "__snapshot_a94a8_test_4",
        2,
        4,
        2,
        [
          "attr 1",
          "attr 2",
        ],
      ]
    `);

    expect(snapshotInstanceManager.values.size).toEqual(1);
    snapshotPatchApply(patch);
    const si1 = snapshotInstanceManager.values.get(bsi1.__id);
    si1.ensureElements();
    expect(si1.__element_root).toMatchInlineSnapshot(`
        <view>
          <text
            text="attr 1"
          />
          <text
            text="attr 2"
          />
        </view>
      `);
  });

  it('basic - setAttributes - when __values exists', async function() {
    const bsi1 = new BackgroundSnapshotInstance(snapshot4);
    bsi1.setAttribute('values', ['attr 1', 'attr 2']);
    const patch = takeGlobalSnapshotPatch();
    expect(patch).toMatchInlineSnapshot(`
      [
        0,
        "__snapshot_a94a8_test_4",
        2,
        4,
        2,
        [
          "attr 1",
          "attr 2",
        ],
      ]
    `);

    patch.push(SnapshotOperation.SetAttributes, 2, ['attr 3', 'attr 4']);

    expect(snapshotInstanceManager.values.size).toEqual(1);
    snapshotPatchApply(patch);
    const si1 = snapshotInstanceManager.values.get(bsi1.__id);
    si1.ensureElements();
    expect(si1.__element_root).toMatchInlineSnapshot(`
      <view>
        <text
          text="attr 3"
        />
        <text
          text="attr 4"
        />
      </view>
    `);
  });

  it('basic - setAttributes - error', async function() {
    const bsi1 = new BackgroundSnapshotInstance(snapshot4);
    const patch = takeGlobalSnapshotPatch();
    patch.push(SnapshotOperation.SetAttributes, 100, ['attr']);
    expect(patch).toMatchInlineSnapshot(`
      [
        0,
        "__snapshot_a94a8_test_4",
        2,
        4,
        100,
        [
          "attr",
        ],
      ]
    `);

    patch.push(SnapshotOperation.SetAttributes, 2, ['attr 3', 'attr 4']);

    expect(snapshotInstanceManager.values.size).toEqual(1);
    snapshotPatchApply(patch);
    expect(_ReportError).toHaveBeenCalledTimes(1);
    expect(_ReportError.mock.calls).toMatchInlineSnapshot(`
      [
        [
          [Error: snapshotPatchApply failed: ctx not found, snapshot type: 'null'],
          {
            "errorCode": 1101,
          },
        ],
      ]
    `);
    const si1 = snapshotInstanceManager.values.get(bsi1.__id);
    si1.ensureElements();
    expect(si1.__element_root).toMatchInlineSnapshot(`
      <view>
        <text
          text="attr 3"
        />
        <text
          text="attr 4"
        />
      </view>
    `);
  });

  it('error', async function() {
    const bsi1 = new BackgroundSnapshotInstance(snapshot4);
    const patch = takeGlobalSnapshotPatch();
    patch.push(SnapshotOperation.SetAttribute, 3, 2, 1, 'attr');
    expect(patch).toMatchInlineSnapshot(`
      [
        0,
        "__snapshot_a94a8_test_4",
        2,
        3,
        3,
        2,
        1,
        "attr",
      ]
    `);

    expect(snapshotInstanceManager.values.size).toEqual(1);
    snapshotPatchApply(patch);
    expect(_ReportError).toHaveBeenCalledTimes(1);

    expect(_ReportError.mock.calls[0]).toMatchInlineSnapshot(`
      [
        [Error: snapshotPatchApply failed: ctx not found, snapshot type: 'null'],
        {
          "errorCode": 1101,
        },
      ]
    `);
    const si1 = snapshotInstanceManager.values.get(bsi1.__id);
    si1.ensureElements();
    expect(si1.__element_root).toMatchInlineSnapshot(`
      <view>
        <text />
        <text />
      </view>
    `);
  });
});

describe('DEV_ONLY_addSnapshot', () => {
  beforeEach(() => {
    globalEnvManager.switchToBackground();
    initGlobalSnapshotPatch();
  });

  it('basic', () => {
    const uniqID1 = 'basic-0';
    // We have to use `snapshotCreatorMap[uniqID1] =` so that it can be created after `initGlobalSnapshotPatch`
    snapshotCreatorMap[uniqID1] = (uniqID1) => {
      globalThis.createSnapshot(
        uniqID1,
        // The `create` function is stringified and called by `new Function()`
        /* v8 ignore start */
        () => {
          const pageId = 0;
          const el = __CreateView(pageId);
          const el1 = __CreateText(pageId);
          __AppendElement(el, el1);
          const el2 = __CreateRawText('Hello, ReactLynx x Fast Refresh');
          __AppendElement(el1, el2);
          return [
            el,
            el1,
            el2,
          ];
        },
        /* v8 ignore stop */
        null,
        null,
        undefined,
        undefined,
        null,
        true,
      );
    };
    const patch = takeGlobalSnapshotPatch();

    expect(patch).toMatchInlineSnapshot(`
      [
        100,
        "basic-0",
        "(uniqID12) => {
            globalThis.createSnapshot(
              uniqID12,
              // The \`create\` function is stringified and called by \`new Function()\`
              /* v8 ignore start */
              () => {
                const pageId = 0;
                const el = __CreateView(pageId);
                const el1 = __CreateText(pageId);
                __AppendElement(el, el1);
                const el2 = __CreateRawText("Hello, ReactLynx x Fast Refresh");
                __AppendElement(el1, el2);
                return [
                  el,
                  el1,
                  el2
                ];
              },
              /* v8 ignore stop */
              null,
              null,
              void 0,
              void 0,
              null,
              true
            );
          }",
      ]
    `);

    new SnapshotInstance(uniqID1);
    const originalSize = snapshotManager.values.size;

    // Remove the old definition
    snapshotManager.values.delete(uniqID1);
    delete snapshotCreatorMap[uniqID1];

    // Apply patches in main thread
    snapshotPatchApply(patch);
    new SnapshotInstance(uniqID1);

    expect(snapshotManager.values.size).toBe(originalSize);
    expect(snapshotManager.values.has(uniqID1)).toBeTruthy();
    const snapshot = snapshotManager.values.get(uniqID1);
    expect(snapshot).toHaveProperty('create', expect.any(Function));
    const si = new SnapshotInstance(uniqID1);
    expect(si.ensureElements());
    expect(si.__element_root).not.toBeUndefined();
    expect(snapshot).toHaveProperty('update', null);
    expect(snapshot).toHaveProperty('slot', null);
  });

  it('with update', () => {
    const uniqID1 = 'with-update-0';
    // We have to use `snapshotCreatorMap[uniqID1] =` so that it can be created after `initGlobalSnapshotPatch`
    snapshotCreatorMap[uniqID1] = (uniqID1) => {
      globalThis.createSnapshot(
        uniqID1,
        // The `create` and `update` functions are stringified and called by `new Function()`
        /* v8 ignore start */
        function() {
          const pageId = 0;
          const el = __CreateImage(pageId);
          return [
            el,
          ];
        },
        [
          function(ctx) {
            if (ctx.__elements) {
              __SetAttribute(ctx.__elements[0], 'src', ctx.__values[0]);
            }
          },
        ],
        /* v8 ignore stop */
        null,
        undefined,
        undefined,
        null,
        true,
      );
    };

    const patch = takeGlobalSnapshotPatch();

    expect(patch).toMatchInlineSnapshot(`
      [
        100,
        "with-update-0",
        "(uniqID12) => {
            globalThis.createSnapshot(
              uniqID12,
              // The \`create\` and \`update\` functions are stringified and called by \`new Function()\`
              /* v8 ignore start */
              function() {
                const pageId = 0;
                const el = __CreateImage(pageId);
                return [
                  el
                ];
              },
              [
                function(ctx) {
                  if (ctx.__elements) __SetAttribute(ctx.__elements[0], "src", ctx.__values[0]);
                }
              ],
              /* v8 ignore stop */
              null,
              void 0,
              void 0,
              null,
              true
            );
          }",
      ]
    `);

    new SnapshotInstance(uniqID1);
    const originalSize = snapshotManager.values.size;

    // Remove the old definition
    snapshotManager.values.delete(uniqID1);
    delete snapshotCreatorMap[uniqID1];

    // Apply patches in main thread
    snapshotPatchApply(patch);
    new SnapshotInstance(uniqID1);

    expect(snapshotManager.values.size).toBe(originalSize);
    expect(snapshotManager.values.has(uniqID1)).toBeTruthy();
    const snapshot = snapshotManager.values.get(uniqID1);
    expect(snapshot).toHaveProperty('create', expect.any(Function));
    const si = new SnapshotInstance(uniqID1);
    expect(si.ensureElements());
    expect(si.__element_root).not.toBeUndefined();
    expect(snapshot).toHaveProperty('update', expect.any(Array));
    si.setAttribute(0, 'foo');
    expect(snapshot.update.every(i => typeof i === 'function')).toBeTruthy();
    expect(snapshot).toHaveProperty('slot', null);
  });

  it('with slot', () => {
    const uniqID1 = 'with-slot-0';
    snapshotCreatorMap[uniqID1] = (uniqID1) => {
      globalThis.createSnapshot(
        uniqID1,
        // The `create` and `update` functions are stringified and called by `new Function()`
        /* v8 ignore start */
        function() {
          const pageId = ReactLynx.__pageId;
          const el = __CreateView(pageId);
          __SetClasses(el, 'Logo');
          return [
            el,
          ];
        },
        [
          function(ctx) {
            if (ctx.__elements) {
              __AddEvent(ctx.__elements[0], 'bindEvent', 'tap', `${ctx.__id}:${0}:`);
            }
          },
        ],
        /* v8 ignore stop */
        [globalThis.DynamicPartType.Children, 0],
        undefined,
        undefined,
        null,
        true,
      );
    };

    const patch = takeGlobalSnapshotPatch();

    expect(patch).toMatchInlineSnapshot(`
      [
        100,
        "with-slot-0",
        "(uniqID12) => {
            globalThis.createSnapshot(
              uniqID12,
              // The \`create\` and \`update\` functions are stringified and called by \`new Function()\`
              /* v8 ignore start */
              function() {
                const pageId = ReactLynx.__pageId;
                const el = __CreateView(pageId);
                __SetClasses(el, "Logo");
                return [
                  el
                ];
              },
              [
                function(ctx) {
                  if (ctx.__elements) __AddEvent(ctx.__elements[0], "bindEvent", "tap", \`\${ctx.__id}:\${0}:\`);
                }
              ],
              /* v8 ignore stop */
              [
                globalThis.DynamicPartType.Children,
                0
              ],
              void 0,
              void 0,
              null,
              true
            );
          }",
      ]
    `);

    new SnapshotInstance(uniqID1);
    const originalSize = snapshotManager.values.size;

    // Remove the old definition
    snapshotManager.values.delete(uniqID1);
    delete snapshotCreatorMap[uniqID1];

    // Apply patches in main thread
    snapshotPatchApply(patch);
    new SnapshotInstance(uniqID1);

    expect(snapshotManager.values.size).toBe(originalSize);
    expect(snapshotManager.values.has(uniqID1)).toBeTruthy();
    const snapshot = snapshotManager.values.get(uniqID1);
    expect(snapshot).toHaveProperty('create', expect.any(Function));
    expect(snapshot).toHaveProperty('update', expect.any(Array));
    expect(snapshot.update.every(i => typeof i === 'function')).toBeTruthy();
    expect(snapshot).toHaveProperty('slot', [3, 0]);
  });

  it('with list', () => {
    const uniqID1 = 'with-list-0';
    snapshotCreatorMap[uniqID1] = (uniqID1) => {
      globalThis.createSnapshot(
        uniqID1,
        // The `create` and `update` functions are stringified and called by `new Function()`
        /* v8 ignore start */
        function() {
          const pageId = ReactLynx.__pageId;
          const el = __CreateView(pageId);
          __SetClasses(el, 'Logo');
          return [
            el,
          ];
        },
        [
          function(ctx) {
            if (ctx.__elements) {
              __AddEvent(ctx.__elements[0], 'bindEvent', 'tap', `${ctx.__id}:${0}:`);
            }
          },
        ],
        /* v8 ignore stop */
        [[globalThis.DynamicPartType.ListChildren]],
        undefined,
        undefined,
        null,
        true,
      );
    };

    const patch = takeGlobalSnapshotPatch();

    expect(patch).toMatchInlineSnapshot(`
      [
        100,
        "with-list-0",
        "(uniqID12) => {
            globalThis.createSnapshot(
              uniqID12,
              // The \`create\` and \`update\` functions are stringified and called by \`new Function()\`
              /* v8 ignore start */
              function() {
                const pageId = ReactLynx.__pageId;
                const el = __CreateView(pageId);
                __SetClasses(el, "Logo");
                return [
                  el
                ];
              },
              [
                function(ctx) {
                  if (ctx.__elements) __AddEvent(ctx.__elements[0], "bindEvent", "tap", \`\${ctx.__id}:\${0}:\`);
                }
              ],
              /* v8 ignore stop */
              [
                [
                  globalThis.DynamicPartType.ListChildren
                ]
              ],
              void 0,
              void 0,
              null,
              true
            );
          }",
      ]
    `);

    new SnapshotInstance(uniqID1);
    const originalSize = snapshotManager.values.size;

    // Remove the old definition
    snapshotManager.values.delete(uniqID1);
    delete snapshotCreatorMap[uniqID1];

    // Apply patches in main thread
    snapshotPatchApply(patch);
    new SnapshotInstance(uniqID1);

    expect(snapshotManager.values.size).toBe(originalSize);
    expect(snapshotManager.values.has(uniqID1)).toBeTruthy();
    const snapshot = snapshotManager.values.get(uniqID1);
    expect(snapshot).toHaveProperty('create', expect.any(Function));
    expect(snapshot).toHaveProperty('update', expect.any(Array));
    expect(snapshot.update.every(i => typeof i === 'function')).toBeTruthy();
    expect(snapshot).toHaveProperty('slot', [[4]]);
    expect(snapshot.isListHolder).toBe(true);
  });

  it('with cssId', () => {
    const uniqID1 = 'with-cssId-0';
    // We have to use `snapshotCreatorMap[uniqID1] =` so that it can be created after `initGlobalSnapshotPatch`
    snapshotCreatorMap[uniqID1] = (uniqID1) => {
      globalThis.createSnapshot(
        uniqID1,
        // The `create` function is stringified and called by `new Function()`
        /* v8 ignore start */
        () => {
          const pageId = 0;
          const el = __CreateView(pageId);
          const el1 = __CreateText(pageId);
          __AppendElement(el, el1);
          const el2 = __CreateRawText('Hello, ReactLynx x Fast Refresh');
          __AppendElement(el1, el2);
          return [
            el,
            el1,
            el2,
          ];
        },
        /* v8 ignore stop */
        null,
        null,
        1000,
        undefined,
        null,
        true,
      );
    };

    const patch = takeGlobalSnapshotPatch();

    expect(patch).toMatchInlineSnapshot(`
      [
        100,
        "with-cssId-0",
        "(uniqID12) => {
            globalThis.createSnapshot(
              uniqID12,
              // The \`create\` function is stringified and called by \`new Function()\`
              /* v8 ignore start */
              () => {
                const pageId = 0;
                const el = __CreateView(pageId);
                const el1 = __CreateText(pageId);
                __AppendElement(el, el1);
                const el2 = __CreateRawText("Hello, ReactLynx x Fast Refresh");
                __AppendElement(el1, el2);
                return [
                  el,
                  el1,
                  el2
                ];
              },
              /* v8 ignore stop */
              null,
              null,
              1e3,
              void 0,
              null,
              true
            );
          }",
      ]
    `);

    new SnapshotInstance(uniqID1);
    const originalSize = snapshotManager.values.size;

    // Remove the old definition
    snapshotManager.values.delete(uniqID1);
    delete snapshotCreatorMap[uniqID1];

    const fn = vi.fn();
    vi.stubGlobal('__SetCSSId', fn);
    // Apply patches in main thread
    snapshotPatchApply(patch);
    new SnapshotInstance(uniqID1);

    expect(snapshotManager.values.size).toBe(originalSize);
    expect(snapshotManager.values.has(uniqID1)).toBeTruthy();
    const snapshot = snapshotManager.values.get(uniqID1);
    expect(snapshot).toHaveProperty('create', expect.any(Function));
    const si = new SnapshotInstance(uniqID1);
    si.ensureElements();
    expect(si.__element_root).not.toBeUndefined();
    expect(snapshot).toHaveProperty('cssId', 1000);

    expect(fn).toBeCalledTimes(1);
    expect(fn).toBeCalledWith(si.__elements, 1000);
  });

  it('with cssId and entryName', () => {
    globalThis.entryName = 'FOO';
    const uniqID1 = `${entryName}:with-cssId-entryName-0`;
    // We have to use `snapshotCreatorMap[uniqID1] =` so that it can be created after `initGlobalSnapshotPatch`
    snapshotCreatorMap[uniqID1] = (uniqID1) => {
      globalThis.createSnapshot(
        uniqID1,
        // The `create` function is stringified and called by `new Function()`
        /* v8 ignore start */
        () => {
          const pageId = 0;
          const el = __CreateView(pageId);
          const el1 = __CreateText(pageId);
          __AppendElement(el, el1);
          const el2 = __CreateRawText('Hello, ReactLynx x Fast Refresh');
          __AppendElement(el1, el2);
          return [
            el,
            el1,
            el2,
          ];
        },
        /* v8 ignore stop */
        null,
        null,
        1000,
        entryName,
        null,
        true,
      );
    };

    expect(uniqID1.startsWith(entryName)).toBeTruthy();

    const patch = takeGlobalSnapshotPatch();

    // it is expected that the patch is empty
    // since only standalone lazy bundle will has entryName
    // we should not generate `DEV_ONLY_AddSnapshot`
    // when loading a lazy bundle after hydration
    expect(patch).toMatchInlineSnapshot(`[]`);

    const originalSize = snapshotManager.values.size;
    const fn = vi.fn();
    vi.stubGlobal('__SetCSSId', fn);
    new SnapshotInstance(uniqID1);
    expect(snapshotManager.values.size).toBe(originalSize + 1);
    expect(snapshotManager.values.has(uniqID1)).toBeTruthy();
    const snapshot = snapshotManager.values.get(uniqID1);
    expect(snapshot).toHaveProperty('create', expect.any(Function));
    const si = new SnapshotInstance(uniqID1);
    si.ensureElements();
    expect(si.__element_root).not.toBeUndefined();
    expect(snapshot).toHaveProperty('cssId', 1000);
    expect(snapshot).toHaveProperty('entryName', 'FOO');

    expect(fn).toBeCalledTimes(1);
    expect(fn).toBeCalledWith(si.__elements, 1000, 'FOO');
  });

  it('with entryName only', () => {
    globalThis.entryName = 'BAR';
    const uniqID1 = `${entryName}:with-entryName-only-0`;
    // We have to use `snapshotCreatorMap[uniqID1] =` so that it can be created after `initGlobalSnapshotPatch`
    snapshotCreatorMap[uniqID1] = (uniqID1) => {
      globalThis.createSnapshot(
        uniqID1,
        // The `create` function is stringified and called by `new Function()`
        /* v8 ignore start */
        () => {
          const pageId = 0;
          const el = __CreateView(pageId);
          const el1 = __CreateText(pageId);
          __AppendElement(el, el1);
          const el2 = __CreateRawText('Hello, ReactLynx x Fast Refresh');
          __AppendElement(el1, el2);
          return [
            el,
            el1,
            el2,
          ];
        },
        /* v8 ignore stop */
        null,
        null,
        undefined,
        entryName,
        null,
        true,
      );
    };
    expect(uniqID1.startsWith(entryName)).toBeTruthy();

    const patch = takeGlobalSnapshotPatch();

    // it is expected that the patch is empty
    // since only standalone lazy bundle will has entryName
    // we should not generate `DEV_ONLY_AddSnapshot`
    // when loading a lazy bundle after hydration
    expect(patch).toMatchInlineSnapshot(`[]`);

    const originalSize = snapshotManager.values.size;
    const fn = vi.fn();
    vi.stubGlobal('__SetCSSId', fn);
    new SnapshotInstance(uniqID1);
    expect(snapshotManager.values.size).toBe(originalSize + 1);
    expect(snapshotManager.values.has(uniqID1)).toBeTruthy();
    const snapshot = snapshotManager.values.get(uniqID1);
    expect(snapshot).toHaveProperty('create', expect.any(Function));
    const si = new SnapshotInstance(uniqID1);
    si.ensureElements();
    expect(si.__element_root).not.toBeUndefined();
    expect(snapshot).toHaveProperty('cssId', undefined);
    expect(snapshot).toHaveProperty('entryName', 'BAR');
    expect(fn).toBeCalledTimes(1);
    expect(fn).toBeCalledWith(si.__elements, 0, 'BAR');
  });

  it('with __webpack_require__', () => {
    const __webpack_require__ = vi.fn();
    vi.stubGlobal('__webpack_require__', __webpack_require__);

    const uniqID1 = 'with-__webpack_require__-0';
    snapshotCreatorMap[uniqID1] = (uniqID1) => {
      globalThis.createSnapshot(
        uniqID1,
        /* v8 ignore start */
        () => {
          __webpack_require__('foo');
          return [__CreateView(0)];
        },
        /* v8 ignore stop */
        null,
        null,
        undefined,
        undefined,
        null,
        true,
      );
    };

    const patch = takeGlobalSnapshotPatch();

    expect(patch).toMatchInlineSnapshot(`
      [
        100,
        "with-__webpack_require__-0",
        "(uniqID12) => {
            globalThis.createSnapshot(
              uniqID12,
              /* v8 ignore start */
              () => {
                __webpack_require__("foo");
                return [
                  __CreateView(0)
                ];
              },
              /* v8 ignore stop */
              null,
              null,
              void 0,
              void 0,
              null,
              true
            );
          }",
      ]
    `);

    new SnapshotInstance(uniqID1);
    const originalSize = snapshotManager.values.size;

    // Remove the old definition
    snapshotManager.values.delete(uniqID1);
    delete snapshotCreatorMap[uniqID1];

    snapshotPatchApply(patch);
    new SnapshotInstance(uniqID1);

    expect(snapshotManager.values.size).toBe(originalSize);
    expect(snapshotManager.values.has(uniqID1)).toBeTruthy();
    const snapshot = snapshotManager.values.get(uniqID1);
    expect(snapshot).toHaveProperty('create', expect.any(Function));
    const si = new SnapshotInstance(uniqID1);
    si.ensureElements();
    expect(si.__element_root).not.toBeUndefined();
    expect(__webpack_require__).toBeCalledTimes(1);
    expect(__webpack_require__).toBeCalledWith('foo');

    vi.unstubAllGlobals();
  });
});

describe.skip('DEV_ONLY_RegisterWorklet', () => {
  beforeEach(() => {
    initGlobalSnapshotPatch();
  });

  it('basic', () => {
    registerWorkletOnBackground('main-thread', 'hash-1', () => 'fn-1');
    globalThis.registerWorklet = vi.fn();

    const patch = takeGlobalSnapshotPatch();

    expect(patch).toMatchInlineSnapshot(`
      [
        101,
        "hash-1",
        "() => "fn-1"",
      ]
    `);

    // Apply patches in main thread
    snapshotPatchApply(patch);

    expect(globalThis.registerWorklet).toBeCalledTimes(1);
    expect(globalThis.registerWorklet.mock.calls[0][0]).toMatch('main-thread');
    expect(globalThis.registerWorklet.mock.calls[0][1]).toMatch('hash-1');
    expect(globalThis.registerWorklet.mock.calls[0][2]()).toMatch('fn-1');

    registerWorkletOnBackground('main-thread', 'hash-1', () => 'fn-1');
    expect(globalThis.registerWorklet).toBeCalledTimes(1);
  });
});

describe('list', () => {
  beforeEach(() => {
    initGlobalSnapshotPatch();
  });

  it('should works when created by `snapshotPatchApply`', () => {
    const bsi1 = new BackgroundSnapshotInstance(snapshot1);

    let patch;
    patch = takeGlobalSnapshotPatch();
    expect(patch.length).toMatchInlineSnapshot(`3`);
    snapshotPatchApply(patch);
    const si1 = snapshotInstanceManager.values.get(bsi1.__id);
    si1.ensureElements();

    const bsi2 = new BackgroundSnapshotInstance(snapshot5);
    bsi2.setAttribute('values', ['test']);
    bsi1.insertBefore(bsi2);
    patch = takeGlobalSnapshotPatch();
    expect(patch.length).toMatchInlineSnapshot(`10`);
    snapshotPatchApply(patch);
    expect(si1.__element_root).toMatchInlineSnapshot(`
      <view>
        <text>
          <raw-text
            text="snapshot1"
          />
        </text>
        <view>
          <list
            class="test"
          />
        </view>
      </view>
    `);
  });
});

describe('missing snapshot', () => {
  beforeEach(() => {
    initGlobalSnapshotPatch();
  });

  it('should throw error when missing snapshot', () => {
    expect(() => new BackgroundSnapshotInstance('missing-snapshot')).toThrowError(
      'BackgroundSnapshot not found: missing-snapshot',
    );
    expect(() => new SnapshotInstance('missing-snapshot')).toThrowError('Snapshot not found: missing-snapshot');
  });
});

describe('lazy snapshot', () => {
  it('lazy snapshot should work', () => {
    let oriSize = snapshotManager.values.size;
    expect(snapshotManager.values.size).toBe(oriSize);
    snapshotCreatorMap['snapshot-0'] = (uniqID) => {
      globalThis.createSnapshot(
        uniqID,
        /* v8 ignore start */
        () => {
          return [__CreateView(0)];
        },
        /* v8 ignore stop */
        null,
        null,
        undefined,
        undefined,
        null,
        true,
      );
    };
    expect(snapshotManager.values.size).toBe(oriSize);
    const si = new SnapshotInstance('snapshot-0');
    expect(snapshotManager.values.size).toBe(oriSize + 1);
    expect(si.type).toBe('snapshot-0');
  });
  it('legacy sync createSnapshot should work', () => {
    let oriSize = snapshotManager.values.size;
    expect(snapshotManager.values.size).toBe(oriSize);
    const uniqueId = globalThis.createSnapshot(
      'snapshot-1',
      /* v8 ignore start */
      () => {
        return [__CreateView(0)];
      },
      /* v8 ignore stop */
      null,
      null,
      undefined,
      /** entryName */
      'https://example.com/main.lynx.bundle',
      null,
      /** isLazySnapshotSupported */
      false,
    );
    expect(snapshotManager.values.size).toBe(oriSize + 1);
    const si = new SnapshotInstance(uniqueId);
    expect(si.type).toBe('https://example.com/main.lynx.bundle:snapshot-1');
  });
  it('standalone lazy bundle snapshotCreatorMap set should not generate DEV_ONLY_AddSnapshot', () => {
    initGlobalSnapshotPatch();
    expect(__globalSnapshotPatch).toMatchInlineSnapshot(`[]`);

    const globDynamicComponentEntry = 'https://example.com/main.lynx.bundle';

    snapshotCreatorMap[`${globDynamicComponentEntry}:${'__snapshot_835da_eff1e_1'}`] = (uniqID) => {
      globalThis.createSnapshot(
        uniqID,
        /* v8 ignore start */
        () => {
          return [__CreateView(0)];
        },
        /* v8 ignore stop */
        null,
        null,
        undefined,
        /** entryName */
        globDynamicComponentEntry,
        null,
        /** isLazySnapshotSupported */
        true,
      );
    };

    expect(__globalSnapshotPatch.length).toBe(0);

    deinitGlobalSnapshotPatch();
    expect(__globalSnapshotPatch).toMatchInlineSnapshot(`undefined`);
  });
});
