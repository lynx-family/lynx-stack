/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { options, render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { BackgroundSnapshotInstance, hydrate } from '../../src/backgroundSnapshot';
import { setupDocument } from '../../src/document';
import { setupVNodeSourceHook } from '../../src/debug/vnodeSource';
import { SnapshotOperation, SnapshotOperationParams } from '../../src/lifecycle/patch/snapshotPatch';
import { DIFFED, DOM } from '../../src/renderToOpcodes/constants';
import { __root } from '../../src/root';
import {
  backgroundSnapshotInstanceManager,
  setupPage,
  SnapshotInstance,
  snapshotInstanceManager,
} from '../../src/snapshot';
import { elementTree } from '../utils/nativeMethod';

const HOLE = null;
const ROOT = __SNAPSHOT__(
  <view>
    <text>root</text>
    {HOLE}
  </view>,
);
const ITEM_A = __SNAPSHOT__(<text id={HOLE}>A</text>);
const ITEM_B = __SNAPSHOT__(<image />);
const ITEM_C = __SNAPSHOT__(<view />);

function decodePatch(patch) {
  const operations = [];
  let index = 0;

  while (index < patch.length) {
    const op = patch[index];
    const params = SnapshotOperationParams[op]?.params;
    if (!params) {
      break;
    }
    const paramCount = params.length;
    const args = patch.slice(index + 1, index + 1 + paramCount);
    operations.push({ op, args });
    index += 1 + paramCount;
  }

  return operations;
}

function createBeforeTree() {
  const root = new SnapshotInstance(ROOT);

  const a = new SnapshotInstance(ITEM_A);
  a.setAttribute(0, 'a-old');
  a.setAttribute('meta', 'meta-old');

  const b = new SnapshotInstance(ITEM_B);
  const c = new SnapshotInstance(ITEM_C);

  root.insertBefore(a);
  root.insertBefore(b);
  root.insertBefore(c);

  return JSON.parse(JSON.stringify(root));
}

function createAfterTree(metaValue) {
  const root = new BackgroundSnapshotInstance(ROOT);

  const b = new BackgroundSnapshotInstance(ITEM_B);
  const a = new BackgroundSnapshotInstance(ITEM_A);
  a.setAttribute(0, 'a-new');
  a.setAttribute('meta', metaValue);

  root.insertBefore(b);
  root.insertBefore(a);

  return root;
}

function createBeforeTreeWithDefinedTargetMove() {
  const root = new SnapshotInstance(ROOT);
  const a = new SnapshotInstance(ITEM_A);
  const b = new SnapshotInstance(ITEM_B);
  const c = new SnapshotInstance(ITEM_C);

  root.insertBefore(a);
  root.insertBefore(b);
  root.insertBefore(c);

  return JSON.parse(JSON.stringify(root));
}

function createAfterTreeWithDefinedTargetMove() {
  const root = new BackgroundSnapshotInstance(ROOT);
  const b = new BackgroundSnapshotInstance(ITEM_B);
  const a = new BackgroundSnapshotInstance(ITEM_A);
  const c = new BackgroundSnapshotInstance(ITEM_C);

  root.insertBefore(b);
  root.insertBefore(a);
  root.insertBefore(c);

  return root;
}

describe('backgroundSnapshot profile', () => {
  beforeAll(() => {
    setupDocument();
    setupPage(__CreatePage('0', 0));
    setupVNodeSourceHook();
  });

  describe('hydrate source', () => {
    beforeEach(() => {
      render(null, __root);
      snapshotInstanceManager.clear();
      snapshotInstanceManager.nextId = 0;
      backgroundSnapshotInstanceManager.clear();
      backgroundSnapshotInstanceManager.nextId = 0;
    });

    afterEach(() => {
      render(null, __root);
      elementTree.clear();
    });

    it('should include source in hydrate setAttribute profile args', () => {
      function App({ text }) {
        return <view id={text} />;
      }

      render(<App text='main-thread-value' />, __root);
      const serializedRoot = JSON.parse(JSON.stringify(__root));
      const mainThreadChild = serializedRoot.children?.[0];

      expect(mainThreadChild).toBeDefined();
      options[DIFFED]?.({
        type: 'view',
        __source: {
          fileName: 'backgroundSnapshot-profile.test.jsx',
          lineNumber: 128,
          columnNumber: 18,
        },
        [DOM]: {
          __id: mainThreadChild.id,
        },
      });

      const backgroundRoot = new BackgroundSnapshotInstance('root');
      const backgroundChild = new BackgroundSnapshotInstance(mainThreadChild.type);
      backgroundChild.setAttribute(0, 'background-value');
      backgroundRoot.insertBefore(backgroundChild);

      lynx.performance.profileStart.mockClear();
      lynx.performance.profileEnd.mockClear();

      hydrate(serializedRoot, backgroundRoot);

      const setAttributeProfileCalls = lynx.performance.profileStart.mock.calls.filter(
        ([traceName]) => traceName === 'ReactLynx::hydrate::setAttribute',
      );

      expect(setAttributeProfileCalls).toHaveLength(1);
      expect(setAttributeProfileCalls[0][1]).toEqual(
        expect.objectContaining({
          args: expect.objectContaining({
            id: String(mainThreadChild.id),
            snapshotType: mainThreadChild.type,
            dynamicPartIndex: '0',
            source: 'backgroundSnapshot-profile.test.jsx:128:18',
          }),
        }),
      );
    });
  });

  describe('hydrate branches', () => {
    beforeEach(() => {
      snapshotInstanceManager.clear();
      snapshotInstanceManager.nextId = 0;
      backgroundSnapshotInstanceManager.clear();
      backgroundSnapshotInstanceManager.nextId = 0;
    });

    afterEach(() => {
      globalThis.__PROFILE__ = true;
    });

    it('should apply non-profile hydrate branches for setAttribute/remove/move', () => {
      const originalProfileFlag = globalThis.__PROFILE__;
      globalThis.__PROFILE__ = false;

      try {
        const before = createBeforeTree();
        const after = createAfterTree('meta-new');

        lynx.performance.profileStart.mockClear();
        lynx.performance.profileEnd.mockClear();

        const patch = hydrate(before, after);
        const operations = decodePatch(patch);

        expect(lynx.performance.profileStart).not.toBeCalled();
        expect(lynx.performance.profileEnd).not.toBeCalled();
        expect(operations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              op: SnapshotOperation.SetAttribute,
              args: expect.arrayContaining([before.children[0].id, 0, 'a-new']),
            }),
            expect.objectContaining({
              op: SnapshotOperation.SetAttribute,
              args: expect.arrayContaining([before.children[0].id, 'meta', 'meta-new']),
            }),
            expect.objectContaining({
              op: SnapshotOperation.RemoveChild,
              args: [before.id, before.children[2].id],
            }),
            expect.objectContaining({
              op: SnapshotOperation.InsertBefore,
              args: [before.id, before.children[0].id, undefined],
            }),
          ]),
        );
      } finally {
        globalThis.__PROFILE__ = originalProfileFlag;
      }
    });

    it('should profile hydrate extraProps null valueType and empty move targetId', () => {
      const originalProfileFlag = globalThis.__PROFILE__;
      globalThis.__PROFILE__ = true;

      try {
        const before = createBeforeTree();
        const after = createAfterTree(null);

        lynx.performance.profileStart.mockClear();
        lynx.performance.profileEnd.mockClear();

        hydrate(before, after);

        const setAttributeCalls = lynx.performance.profileStart.mock.calls.filter(
          ([traceName]) => traceName === 'ReactLynx::hydrate::setAttribute',
        );
        const insertBeforeCalls = lynx.performance.profileStart.mock.calls.filter(
          ([traceName]) => traceName === 'ReactLynx::hydrate::insertBefore',
        );

        expect(
          setAttributeCalls.some(([, option]) => (
            option?.args?.dynamicPartIndex === 'meta' && option?.args?.valueType === 'null'
          )),
        ).toBe(true);
        expect(
          insertBeforeCalls.some(([, option]) => option?.args?.targetId === ''),
        ).toBe(true);
      } finally {
        globalThis.__PROFILE__ = originalProfileFlag;
      }
    });

    it('should apply non-profile move branch with defined target id', () => {
      const originalProfileFlag = globalThis.__PROFILE__;
      globalThis.__PROFILE__ = false;

      try {
        const before = createBeforeTreeWithDefinedTargetMove();
        const after = createAfterTreeWithDefinedTargetMove();

        const patch = hydrate(before, after);
        const operations = decodePatch(patch);
        const moveWithDefinedTarget = operations.find(({ op, args }) => (
          op === SnapshotOperation.InsertBefore
          && args[0] === before.id
          && args[2] !== undefined
        ));

        expect(moveWithDefinedTarget).toBeDefined();
      } finally {
        globalThis.__PROFILE__ = originalProfileFlag;
      }
    });
  });
});
