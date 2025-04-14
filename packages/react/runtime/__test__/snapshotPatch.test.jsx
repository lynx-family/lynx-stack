import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BackgroundSnapshotInstance } from '../src/backgroundSnapshot';
import { elementTree } from './utils/nativeMethod';
import { registerWorkletOnBackground } from '../src/internal';
import {
  SnapshotOperation,
  initGlobalSnapshotPatch,
  takeGlobalSnapshotPatch,
} from '../src/lifecycle/patch/snapshotPatch';
import { snapshotPatchApply } from '../src/lifecycle/patch/snapshotPatchApply';
import {
  DynamicPartType,
  SnapshotInstance,
  backgroundSnapshotInstanceManager,
  createSnapshot,
  snapshotInstanceManager,
  snapshotManager,
} from '../src/snapshot';

const HOLE = null;

beforeEach(() => {
  backgroundSnapshotInstanceManager.clear();
  backgroundSnapshotInstanceManager.nextId = 0;
  snapshotInstanceManager.clear();
  snapshotInstanceManager.nextId = 0;
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
        "__Card__:__snapshot_a94a8_test_1",
        1,
        0,
        "__Card__:__snapshot_a94a8_test_2",
        2,
      ]
    `);

    expect(snapshotInstanceManager.values.size).toEqual(0);
    snapshotPatchApply(patch);
    expect(snapshotInstanceManager.values.size).toEqual(2);
    const si1 = snapshotInstanceManager.values.get(1);
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
    const si2 = snapshotInstanceManager.values.get(2);
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
        "__Card__:__snapshot_a94a8_test_1",
        1,
        0,
        "__Card__:__snapshot_a94a8_test_2",
        2,
        1,
        1,
        2,
        undefined,
      ]
    `);

    expect(snapshotInstanceManager.values.size).toEqual(0);
    snapshotPatchApply(patch);
    expect(snapshotInstanceManager.values.size).toEqual(2);
    const si1 = snapshotInstanceManager.values.get(1);
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
        "__Card__:__snapshot_a94a8_test_1",
        1,
        0,
        "__Card__:__snapshot_a94a8_test_2",
        2,
        0,
        "__Card__:__snapshot_a94a8_test_3",
        3,
        1,
        1,
        3,
        undefined,
        1,
        1,
        2,
        3,
      ]
    `);

    expect(snapshotInstanceManager.values.size).toEqual(0);
    snapshotPatchApply(patch);
    expect(snapshotInstanceManager.values.size).toEqual(3);
    const si1 = snapshotInstanceManager.values.get(1);
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
    patch.push(SnapshotOperation.InsertBefore, 1, 100, null, SnapshotOperation.InsertBefore, 100, 2, null);
    expect(patch).toMatchInlineSnapshot(`
      [
        0,
        "__Card__:__snapshot_a94a8_test_1",
        1,
        0,
        "__Card__:__snapshot_a94a8_test_2",
        2,
        1,
        1,
        100,
        null,
        1,
        100,
        2,
        null,
      ]
    `);

    expect(snapshotInstanceManager.values.size).toEqual(0);
    snapshotPatchApply(patch);
    expect(_ReportError).toHaveBeenCalledTimes(2);
    expect(_ReportError.mock.calls).toMatchInlineSnapshot(`
      [
        [
          [Error: snapshotPatchApply failed: ctx not found],
          {
            "errorCode": 1101,
          },
        ],
        [
          [Error: snapshotPatchApply failed: ctx not found],
          {
            "errorCode": 1101,
          },
        ],
      ]
    `);
    expect(snapshotInstanceManager.values.size).toEqual(2);
    const si1 = snapshotInstanceManager.values.get(1);
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

    const si1 = snapshotInstanceManager.values.get(1);
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
        1,
        2,
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

    const si1 = snapshotInstanceManager.values.get(1);
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
        1,
        2,
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
    patch.push(SnapshotOperation.RemoveChild, 1, 2, SnapshotOperation.RemoveChild, 100, 1);
    expect(patch).toMatchInlineSnapshot(`
      [
        2,
        1,
        2,
        2,
        100,
        1,
      ]
    `);
    snapshotPatchApply(patch);
    expect(_ReportError).toHaveBeenCalledTimes(2);

    expect(_ReportError.mock.calls).toMatchInlineSnapshot(`
      [
        [
          [Error: snapshotPatchApply failed: ctx not found],
          {
            "errorCode": 1101,
          },
        ],
        [
          [Error: snapshotPatchApply failed: ctx not found],
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
        1,
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
        "__Card__:__snapshot_a94a8_test_4",
        1,
        3,
        1,
        0,
        "attr 1",
        3,
        1,
        1,
        "attr 2",
      ]
    `);

    expect(snapshotInstanceManager.values.size).toEqual(0);
    snapshotPatchApply(patch);
    const si1 = snapshotInstanceManager.values.get(1);
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
        "__Card__:__snapshot_a94a8_test_4",
        1,
        4,
        1,
        [
          "attr 1",
          "attr 2",
        ],
      ]
    `);

    expect(snapshotInstanceManager.values.size).toEqual(0);
    snapshotPatchApply(patch);
    const si1 = snapshotInstanceManager.values.get(1);
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
        "__Card__:__snapshot_a94a8_test_4",
        1,
        4,
        1,
        [
          "attr 1",
          "attr 2",
        ],
      ]
    `);

    patch.push(SnapshotOperation.SetAttributes, 1, ['attr 3', 'attr 4']);

    expect(snapshotInstanceManager.values.size).toEqual(0);
    snapshotPatchApply(patch);
    const si1 = snapshotInstanceManager.values.get(1);
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
        "__Card__:__snapshot_a94a8_test_4",
        1,
        4,
        100,
        [
          "attr",
        ],
      ]
    `);

    patch.push(SnapshotOperation.SetAttributes, 1, ['attr 3', 'attr 4']);

    expect(snapshotInstanceManager.values.size).toEqual(0);
    snapshotPatchApply(patch);
    expect(_ReportError).toHaveBeenCalledTimes(1);
    expect(_ReportError.mock.calls).toMatchInlineSnapshot(`
      [
        [
          [Error: snapshotPatchApply failed: ctx not found],
          {
            "errorCode": 1101,
          },
        ],
      ]
    `);
    const si1 = snapshotInstanceManager.values.get(1);
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
        "__Card__:__snapshot_a94a8_test_4",
        1,
        3,
        3,
        2,
        1,
        "attr",
      ]
    `);

    expect(snapshotInstanceManager.values.size).toEqual(0);
    snapshotPatchApply(patch);
    expect(_ReportError).toHaveBeenCalledTimes(1);

    expect(_ReportError.mock.calls[0]).toMatchInlineSnapshot(`
      [
        [Error: snapshotPatchApply failed: ctx not found],
        {
          "errorCode": 1101,
        },
      ]
    `);
    const si1 = snapshotInstanceManager.values.get(1);
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
    initGlobalSnapshotPatch();
  });

  it('basic', () => {
    // We have to use `createSnapshot` so that is can be created after `initGlobalSnapshotPatch`
    const uniqID1 = createSnapshot(
      'basic-0',
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
    );

    const patch = takeGlobalSnapshotPatch();

    expect(patch).toMatchInlineSnapshot(`
      [
        100,
        "basic-0",
        "() => {
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
            }",
        [],
        null,
        undefined,
        undefined,
      ]
    `);

    const originalSize = snapshotManager.values.size;

    // Remove the old definition
    snapshotManager.values.delete(uniqID1);

    // Apply patches in main thread
    snapshotPatchApply(patch);

    expect(snapshotManager.values.size).toBe(originalSize);
    expect(snapshotManager.values.has(uniqID1)).toBeTruthy();
    const snapshot = snapshotManager.values.get(uniqID1);
    expect(snapshot).toHaveProperty('create', expect.any(Function));
    const si = new SnapshotInstance(uniqID1);
    expect(si.ensureElements());
    expect(si.__element_root).not.toBeUndefined();
    expect(snapshot).toHaveProperty('update', expect.any(Array));
    expect(snapshot).toHaveProperty('slot', null);
  });

  it('with update', () => {
    // We have to use `createSnapshot` so that is can be created after `initGlobalSnapshotPatch`
    const uniqID1 = createSnapshot(
      'with-update-0',
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
    );

    const patch = takeGlobalSnapshotPatch();

    expect(patch).toMatchInlineSnapshot(`
      [
        100,
        "with-update-0",
        "function() {
              const pageId = 0;
              const el = __CreateImage(pageId);
              return [
                el
              ];
            }",
        [
          "function(ctx) {
                if (ctx.__elements) __SetAttribute(ctx.__elements[0], "src", ctx.__values[0]);
              }",
        ],
        null,
        undefined,
        undefined,
      ]
    `);

    const originalSize = snapshotManager.values.size;

    // Remove the old definition
    snapshotManager.values.delete(uniqID1);

    // Apply patches in main thread
    snapshotPatchApply(patch);

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
    const uniqID1 = createSnapshot(
      'with-slot-0',
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
      [DynamicPartType.Children, 0],
    );

    const patch = takeGlobalSnapshotPatch();

    expect(patch).toMatchInlineSnapshot(`
      [
        100,
        "with-slot-0",
        "function() {
              const pageId = ReactLynx.__pageId;
              const el = __CreateView(pageId);
              __SetClasses(el, "Logo");
              return [
                el
              ];
            }",
        [
          "function(ctx) {
                if (ctx.__elements) __AddEvent(ctx.__elements[0], "bindEvent", "tap", \`\${ctx.__id}:\${0}:\`);
              }",
        ],
        [
          3,
          0,
        ],
        undefined,
        undefined,
      ]
    `);

    const originalSize = snapshotManager.values.size;

    // Remove the old definition
    snapshotManager.values.delete(uniqID1);

    // Apply patches in main thread
    snapshotPatchApply(patch);

    expect(snapshotManager.values.size).toBe(originalSize);
    expect(snapshotManager.values.has(uniqID1)).toBeTruthy();
    const snapshot = snapshotManager.values.get(uniqID1);
    expect(snapshot).toHaveProperty('create', expect.any(Function));
    expect(snapshot).toHaveProperty('update', expect.any(Array));
    expect(snapshot.update.every(i => typeof i === 'function')).toBeTruthy();
    expect(snapshot).toHaveProperty('slot', [3, 0]);
  });

  it('with list', () => {
    const uniqID1 = createSnapshot(
      'with-list-0',
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
      [[DynamicPartType.ListChildren]],
    );

    const patch = takeGlobalSnapshotPatch();

    expect(patch).toMatchInlineSnapshot(`
      [
        100,
        "with-list-0",
        "function() {
              const pageId = ReactLynx.__pageId;
              const el = __CreateView(pageId);
              __SetClasses(el, "Logo");
              return [
                el
              ];
            }",
        [
          "function(ctx) {
                if (ctx.__elements) __AddEvent(ctx.__elements[0], "bindEvent", "tap", \`\${ctx.__id}:\${0}:\`);
              }",
        ],
        [
          [
            4,
          ],
        ],
        undefined,
        undefined,
      ]
    `);

    const originalSize = snapshotManager.values.size;

    // Remove the old definition
    snapshotManager.values.delete(uniqID1);

    // Apply patches in main thread
    snapshotPatchApply(patch);

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
    // We have to use `createSnapshot` so that is can be created after `initGlobalSnapshotPatch`
    const uniqID1 = createSnapshot(
      'with-cssId-0',
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
    );

    const patch = takeGlobalSnapshotPatch();

    expect(patch).toMatchInlineSnapshot(`
      [
        100,
        "with-cssId-0",
        "() => {
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
            }",
        [],
        null,
        1000,
        undefined,
      ]
    `);

    const originalSize = snapshotManager.values.size;

    // Remove the old definition
    snapshotManager.values.delete(uniqID1);

    const fn = vi.fn();
    vi.stubGlobal('__SetCSSId', fn);
    // Apply patches in main thread
    snapshotPatchApply(patch);

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
    const entryName = 'FOO';
    // We have to use `createSnapshot` so that is can be created after `initGlobalSnapshotPatch`
    const uniqID1 = createSnapshot(
      'with-cssId-entryName-0',
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
    );

    expect(uniqID1.startsWith(entryName)).toBeTruthy();

    const patch = takeGlobalSnapshotPatch();

    expect(patch).toMatchInlineSnapshot(`
      [
        100,
        "with-cssId-entryName-0",
        "() => {
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
            }",
        [],
        null,
        1000,
        "FOO",
      ]
    `);

    const originalSize = snapshotManager.values.size;

    // Remove the old definition
    snapshotManager.values.delete(uniqID1);

    const fn = vi.fn();
    vi.stubGlobal('__SetCSSId', fn);
    // Apply patches in main thread
    snapshotPatchApply(patch);

    expect(snapshotManager.values.size).toBe(originalSize);
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
    const entryName = 'BAR';
    // We have to use `createSnapshot` so that is can be created after `initGlobalSnapshotPatch`
    const uniqID1 = createSnapshot(
      'with-entryName-only-0',
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
    );
    expect(uniqID1.startsWith(entryName)).toBeTruthy();

    const patch = takeGlobalSnapshotPatch();

    expect(patch).toMatchInlineSnapshot(`
      [
        100,
        "with-entryName-only-0",
        "() => {
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
            }",
        [],
        null,
        undefined,
        "BAR",
      ]
    `);

    const originalSize = snapshotManager.values.size;

    // Remove the old definition
    snapshotManager.values.delete(uniqID1);

    const fn = vi.fn();
    vi.stubGlobal('__SetCSSId', fn);
    // Apply patches in main thread
    snapshotPatchApply(patch);

    expect(snapshotManager.values.size).toBe(originalSize);
    expect(snapshotManager.values.has(uniqID1)).toBeTruthy();
    const snapshot = snapshotManager.values.get(uniqID1);
    expect(snapshot).toHaveProperty('create', expect.any(Function));
    const si = new SnapshotInstance(uniqID1);
    si.ensureElements();
    expect(si.__element_root).not.toBeUndefined();
    expect(snapshot).toHaveProperty('cssId', 0);
    expect(snapshot).toHaveProperty('entryName', 'BAR');
    expect(fn).toBeCalledTimes(1);
    expect(fn).toBeCalledWith(si.__elements, 0, 'BAR');
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
    const si1 = snapshotInstanceManager.values.get(1);
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
