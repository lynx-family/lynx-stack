// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { globalEnvManager } from './utils/envManager.js';
import { addCtxNotFoundEventListener, reportCtxNotFound } from '../../src/snapshot/lifecycle/patch/error.js';
import { SnapshotOperation } from '../../src/snapshot/lifecycle/patch/snapshotPatch.js';
import { snapshotPatchApply } from '../../src/snapshot/lifecycle/patch/snapshotPatchApply.js';
import { injectUpdateMainThread } from '../../src/snapshot/lifecycle/patch/updateMainThread.js';
import { LifecycleConstant } from '../../src/snapshot/lifecycle/constant.js';
import { getReloadVersion } from '../../src/core/reload-version.js';
import { createSnapshot, setupPage, snapshotManager } from '../../src/snapshot/snapshot/definition.js';
import { SnapshotInstance } from '../../src/snapshot/snapshot/snapshot.js';
import { BackgroundSnapshotInstance } from '../../src/snapshot/snapshot/backgroundSnapshot.js';

beforeAll(() => {
  globalEnvManager.resetEnv();
  globalEnvManager.switchToBackground();
  addCtxNotFoundEventListener();
  globalEnvManager.switchToMainThread();
  setupPage(__CreatePage('0', 0));
  injectUpdateMainThread();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
  vi.clearAllMocks();
  vi.spyOn(lynx, 'reportError');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function reportedMessage(): string {
  return (vi.mocked(lynx.reportError).mock.calls[0]![0] as Error).message;
}

describe('ctx-not-found diagnostics', () => {
  it.each(['InsertBefore', 'RemoveChild'] as const)(
    'reports parent and child IDs when either node is missing in %s',
    operation => {
      const cases = [
        { parentExists: false, childExists: true, missingNode: 1 },
        { parentExists: true, childExists: false, missingNode: 2 },
        { parentExists: false, childExists: false, missingNode: 3 },
      ];
      for (const { parentExists, childExists, missingNode } of cases) {
        globalEnvManager.resetEnv();
        vi.clearAllMocks();
        if (parentExists) {
          new SnapshotInstance('view', 100);
        }
        if (childExists) {
          new SnapshotInstance('view', 101);
        }
        const patch = operation === 'InsertBefore'
          ? [SnapshotOperation.InsertBefore, 100, 101, undefined, 0]
          : [SnapshotOperation.RemoveChild, 100, 101];
        snapshotPatchApply(patch, 42, false);
        expect(lynx.getJSContext().dispatchEvent).toHaveBeenCalledExactlyOnceWith({
          type: 'Lynx.Error.CtxNotFound',
          data: {
            id: parentExists ? 101 : 100,
            options: {
              operation,
              commitId: 42,
              isHydration: false,
              parent: 100,
              child: 101,
              missingNode,
            },
          },
        });
        expect(lynx.reportError).toHaveBeenCalledTimes(1);
        expect(reportedMessage()).toBe(
          `snapshotPatchApply failed: ctx not found, snapshot type: 'null', parent: { id: 100, snapshot type: 'null', missing: ${!parentExists} }, child: { id: 101, snapshot type: 'null', missing: ${!childExists} }, operation: '${operation}', commitId: 42, isHydration: false. You can set environment variable \`REACT_ALOG=true\` and restart your dev server for troubleshooting.`,
        );
      }
    },
  );

  it.each([undefined, false, true])('reports commit IDs and hydration flag %s', flag => {
    vi.stubGlobal('__ALOG__', false);
    vi.stubGlobal('__DEV__', false);
    const isHydration = flag === true;
    const patchList = [
      { id: 41, snapshotPatch: [SnapshotOperation.RemoveChild, 100, 101] },
      { id: 42, snapshotPatch: [SnapshotOperation.SetAttributes, 102, ['attribute-value']] },
    ];
    Reflect.get(globalThis, LifecycleConstant.patchUpdate)({
      data: JSON.stringify({ patchList }),
      patchOptions: { reloadVersion: getReloadVersion(), ...(flag === undefined ? {} : { isHydration: flag }) },
    });
    expect(lynx.getJSContext().dispatchEvent).toHaveBeenCalledTimes(2);
    expect(vi.mocked(lynx.getJSContext().dispatchEvent).mock.calls.map(([event]) => event.data)).toEqual([
      {
        id: 100,
        options: {
          operation: 'RemoveChild',
          commitId: 41,
          isHydration,
          parent: 100,
          child: 101,
          missingNode: 3,
        },
      },
      { id: 102, options: { operation: 'SetAttributes', commitId: 42, isHydration } },
    ]);
    expect(vi.mocked(lynx.reportError).mock.calls.map(([error]) => (error as Error).message)).toEqual([
      `snapshotPatchApply failed: ctx not found, snapshot type: 'null', parent: { id: 100, snapshot type: 'null', missing: true }, child: { id: 101, snapshot type: 'null', missing: true }, operation: 'RemoveChild', commitId: 41, isHydration: ${isHydration}`,
      `snapshotPatchApply failed: ctx not found, snapshot type: 'null', parent: null, operation: 'SetAttributes', commitId: 42, isHydration: ${isHydration}`,
    ]);
  });

  it.each(['SetAttribute', 'SetAttributes'] as const)('includes the background parent in %s errors', operation => {
    vi.stubGlobal('__DEV__', false);
    globalEnvManager.switchToBackground();
    const parent = new BackgroundSnapshotInstance('view');
    const child = new BackgroundSnapshotInstance('text');
    parent.appendChild(child);
    globalEnvManager.switchToMainThread();
    const patch = operation === 'SetAttribute'
      ? [SnapshotOperation.SetAttribute, child.__id, 0, 'attribute-value']
      : [SnapshotOperation.SetAttributes, child.__id, ['attribute-value']];
    snapshotPatchApply(patch, 42, false);
    expect(lynx.getJSContext().dispatchEvent).toHaveBeenCalledTimes(1);
    expect(reportedMessage()).toBe(
      `snapshotPatchApply failed: ctx not found, snapshot type: 'text', parent: { id: ${parent.__id}, snapshot type: 'view' }, operation: '${operation}', commitId: 42, isHydration: false`,
    );
  });

  it('includes both snapshot types in one error even when reporting throws', () => {
    vi.stubGlobal('__DEV__', false);
    globalEnvManager.switchToBackground();
    const parent = new BackgroundSnapshotInstance('view');
    const child = new BackgroundSnapshotInstance('text');
    globalEnvManager.switchToMainThread();
    vi.mocked(lynx.reportError).mockImplementationOnce(error => {
      throw error;
    });
    expect(() => snapshotPatchApply([SnapshotOperation.RemoveChild, parent.__id, child.__id], 42, false))
      .toThrowError(
        `snapshotPatchApply failed: ctx not found, snapshot type: 'view', parent: { id: ${parent.__id}, snapshot type: 'view', missing: true }, child: { id: ${child.__id}, snapshot type: 'text', missing: true }, operation: 'RemoveChild', commitId: 42, isHydration: false`,
      );
    expect(lynx.getJSContext().dispatchEvent).toHaveBeenCalledTimes(1);
    expect(lynx.reportError).toHaveBeenCalledTimes(1);
  });

  it('uses the explicit parent ID instead of the background parent', () => {
    vi.stubGlobal('__DEV__', false);
    globalEnvManager.switchToBackground();
    const backgroundParent = new BackgroundSnapshotInstance('view');
    const child = new BackgroundSnapshotInstance('text');
    const explicitParent = new BackgroundSnapshotInstance('view');
    backgroundParent.appendChild(child);
    reportCtxNotFound({
      id: child.__id,
      options: {
        operation: 'InsertBefore',
        commitId: 42,
        isHydration: true,
        parent: explicitParent.__id,
        child: child.__id,
      },
    });
    expect(lynx.reportError).toHaveBeenCalledTimes(1);
    expect(reportedMessage()).toBe(
      `snapshotPatchApply failed: ctx not found, snapshot type: 'text', parent: { id: ${explicitParent.__id}, snapshot type: 'view' }, child: { id: ${child.__id}, snapshot type: 'text' }, operation: 'InsertBefore', commitId: 42, isHydration: true`,
    );
  });

  it('preserves zero parent and child IDs', () => {
    vi.stubGlobal('__DEV__', false);
    globalEnvManager.switchToBackground();
    const parent = new BackgroundSnapshotInstance('view');
    const child = new BackgroundSnapshotInstance('text');
    parent.appendChild(child);
    reportCtxNotFound({
      id: child.__id,
      options: {
        operation: 'InsertBefore',
        commitId: 42,
        isHydration: false,
        parent: 0,
        child: 0,
      },
    });
    expect(lynx.reportError).toHaveBeenCalledTimes(1);
    expect(reportedMessage()).toBe(
      'snapshotPatchApply failed: ctx not found, snapshot type: \'text\', parent: { id: 0, snapshot type: \'null\' }, child: { id: 0, snapshot type: \'null\' }, operation: \'InsertBefore\', commitId: 42, isHydration: false',
    );
  });

  it.each(['div', null])('preserves null snapshot types for parent and child with type %s', type => {
    vi.stubGlobal('__DEV__', false);
    globalEnvManager.switchToBackground();
    const parent = new BackgroundSnapshotInstance(type as string);
    const child = new BackgroundSnapshotInstance(type as string);
    globalEnvManager.switchToMainThread();
    snapshotPatchApply([SnapshotOperation.RemoveChild, parent.__id, child.__id], 42, false);
    expect(reportedMessage()).toBe(
      `snapshotPatchApply failed: ctx not found, snapshot type: 'null', parent: { id: ${parent.__id}, snapshot type: 'null', missing: true }, child: { id: ${child.__id}, snapshot type: 'null', missing: true }, operation: 'RemoveChild', commitId: 42, isHydration: false`,
    );
  });

  it.each(['removed', 'replaced'] as const)('reports instance types after their definitions are %s', change => {
    vi.stubGlobal('__DEV__', false);
    globalEnvManager.switchToBackground();
    const parent = new BackgroundSnapshotInstance('ctx-not-found-parent');
    const child = new BackgroundSnapshotInstance('ctx-not-found-child');
    parent.appendChild(child);
    for (const instance of [parent, child]) {
      if (change === 'removed') {
        snapshotManager.values.delete(instance.type);
      } else {
        createSnapshot(instance.type, null, null, [], undefined, undefined, null, true);
      }
      expect(snapshotManager.values.get(instance.type)).not.toBe(instance.__snapshot_def);
    }
    globalEnvManager.switchToMainThread();
    snapshotPatchApply([SnapshotOperation.SetAttributes, child.__id, []], 42, false);
    snapshotPatchApply([SnapshotOperation.RemoveChild, parent.__id, child.__id], 43, false);
    expect(lynx.getJSContext().dispatchEvent).toHaveBeenCalledTimes(2);
    expect(vi.mocked(lynx.reportError).mock.calls.map(([error]) => (error as Error).message)).toEqual([
      `snapshotPatchApply failed: ctx not found, snapshot type: 'ctx-not-found-child', parent: { id: ${parent.__id}, snapshot type: 'ctx-not-found-parent' }, operation: 'SetAttributes', commitId: 42, isHydration: false`,
      `snapshotPatchApply failed: ctx not found, snapshot type: 'ctx-not-found-parent', parent: { id: ${parent.__id}, snapshot type: 'ctx-not-found-parent', missing: true }, child: { id: ${child.__id}, snapshot type: 'ctx-not-found-child', missing: true }, operation: 'RemoveChild', commitId: 43, isHydration: false`,
    ]);
  });

  it('includes diagnostics in production without attribute values', () => {
    vi.stubGlobal('__DEV__', false);
    snapshotPatchApply([SnapshotOperation.SetAttributes, 999, ['attribute-value']], 42, false);
    expect(reportedMessage()).toBe(
      'snapshotPatchApply failed: ctx not found, snapshot type: \'null\', parent: null, operation: \'SetAttributes\', commitId: 42, isHydration: false',
    );
  });

  it.each(['div', null])('preserves the null snapshot type for %s', type => {
    vi.stubGlobal('__DEV__', false);
    globalEnvManager.switchToBackground();
    const instance = new BackgroundSnapshotInstance(type as string);
    globalEnvManager.switchToMainThread();
    snapshotPatchApply([SnapshotOperation.SetAttributes, instance.__id, []], 42, false);
    expect(reportedMessage()).toBe(
      'snapshotPatchApply failed: ctx not found, snapshot type: \'null\', parent: null, operation: \'SetAttributes\', commitId: 42, isHydration: false',
    );
  });

  it.each([false, true])('preserves the fallback error with hydration flag %s', isHydration => {
    vi.stubGlobal('lynx', { ...lynx, getJSContext: undefined });
    expect(() => snapshotPatchApply([SnapshotOperation.SetAttributes, 999, []], 42, isHydration))
      .toThrowError(new Error('snapshotPatchApply failed: ctx not found'));
    expect(() => snapshotPatchApply([SnapshotOperation.RemoveChild, 100, 101], 42, isHydration))
      .toThrowError(new Error('snapshotPatchApply failed: ctx not found'));
  });

  it('reports diagnostics and preserves the fallback error when ALOG is unavailable', () => {
    vi.stubGlobal('__DEV__', false);
    vi.stubGlobal('console', { ...console, alog: undefined });
    snapshotPatchApply([SnapshotOperation.SetAttributes, 999, []], 42, false);
    expect(reportedMessage()).toBe(
      'snapshotPatchApply failed: ctx not found, snapshot type: \'null\', parent: null, operation: \'SetAttributes\', commitId: 42, isHydration: false',
    );
    vi.stubGlobal('lynx', { ...lynx, getJSContext: undefined });
    expect(() => snapshotPatchApply([SnapshotOperation.SetAttributes, 999, []], 42, true))
      .toThrowError(new Error('snapshotPatchApply failed: ctx not found'));
  });
});
