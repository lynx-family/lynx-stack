// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { globalEnvManager } from './utils/envManager.js';
import {
  SnapshotOperation,
  initGlobalSnapshotPatch,
  takeGlobalSnapshotPatch,
} from '../../src/snapshot/lifecycle/patch/snapshotPatch.js';
import { snapshotPatchApply } from '../../src/snapshot/lifecycle/patch/snapshotPatchApply.js';
import { BackgroundSnapshotInstance, SnapshotInstance, snapshotInstanceManager } from '../../src/snapshot/index.js';

beforeEach(() => {
  globalEnvManager.resetEnv();
});

describe('snapshot create type dictionary', () => {
  it('keeps the first two creates legacy and indexes later repeats', () => {
    initGlobalSnapshotPatch();
    const firstView = new BackgroundSnapshotInstance('view');
    const secondView = new BackgroundSnapshotInstance('view');
    const thirdView = new BackgroundSnapshotInstance('view');
    const firstText = new BackgroundSnapshotInstance(
      null as unknown as string,
    );
    const secondText = new BackgroundSnapshotInstance(
      null as unknown as string,
    );

    expect(takeGlobalSnapshotPatch()).toEqual([
      SnapshotOperation.CreateElement,
      'view',
      firstView.__id,
      SnapshotOperation.CreateElement,
      'view',
      secondView.__id,
      SnapshotOperation.CreateElementByTypeIndex,
      0,
      thirdView.__id,
      SnapshotOperation.CreateElement,
      null,
      firstText.__id,
      SnapshotOperation.CreateElementByTypeIndex,
      1,
      secondText.__id,
    ]);
  });

  it('keeps one- and two-create patches byte-for-byte legacy', () => {
    initGlobalSnapshotPatch();
    const first = new BackgroundSnapshotInstance('view');
    expect(takeGlobalSnapshotPatch()).toEqual([
      SnapshotOperation.CreateElement,
      'view',
      first.__id,
    ]);

    const second = new BackgroundSnapshotInstance('view');
    const third = new BackgroundSnapshotInstance('view');
    expect(takeGlobalSnapshotPatch()).toEqual([
      SnapshotOperation.CreateElement,
      'view',
      second.__id,
      SnapshotOperation.CreateElement,
      'view',
      third.__id,
    ]);
  });

  it('indexes either of the first two distinct declarations', () => {
    initGlobalSnapshotPatch();
    const firstView = new BackgroundSnapshotInstance('view');
    const firstText = new BackgroundSnapshotInstance(
      null as unknown as string,
    );
    const secondText = new BackgroundSnapshotInstance(
      null as unknown as string,
    );
    const secondView = new BackgroundSnapshotInstance('view');

    expect(takeGlobalSnapshotPatch()).toEqual([
      SnapshotOperation.CreateElement,
      'view',
      firstView.__id,
      SnapshotOperation.CreateElement,
      null,
      firstText.__id,
      SnapshotOperation.CreateElementByTypeIndex,
      1,
      secondText.__id,
      SnapshotOperation.CreateElementByTypeIndex,
      0,
      secondView.__id,
    ]);
  });

  it('starts a new dictionary for every patch', () => {
    initGlobalSnapshotPatch();
    new BackgroundSnapshotInstance('view');
    new BackgroundSnapshotInstance('view');
    takeGlobalSnapshotPatch();

    const next = new BackgroundSnapshotInstance('view');
    expect(takeGlobalSnapshotPatch()).toEqual([
      SnapshotOperation.CreateElement,
      'view',
      next.__id,
    ]);
  });

  it('applies mixed legacy and indexed creates in order', () => {
    snapshotPatchApply([
      SnapshotOperation.CreateElement,
      'view',
      1,
      SnapshotOperation.CreateElementByTypeIndex,
      0,
      2,
      SnapshotOperation.CreateElement,
      null,
      3,
      SnapshotOperation.CreateElementByTypeIndex,
      1,
      4,
    ]);

    expect(snapshotInstanceManager.values.get(1)?.type).toBe('view');
    expect(snapshotInstanceManager.values.get(2)?.type).toBe('view');
    expect(snapshotInstanceManager.values.get(3)?.type).toBeNull();
    expect(snapshotInstanceManager.values.get(4)?.type).toBeNull();
  });

  it.each([-1, 0.5, 1])(
    'rejects invalid type index %s before allocating',
    typeIndex => {
      expect(() =>
        snapshotPatchApply([
          SnapshotOperation.CreateElement,
          'view',
          1,
          SnapshotOperation.CreateElementByTypeIndex,
          typeIndex,
          2,
        ])
      ).toThrow('Invalid snapshot create type index');
      expect(snapshotInstanceManager.values.has(2)).toBe(false);
    },
  );

  it('does not change nested toJSON key semantics', () => {
    const toJSON = vi.fn(function(this: { value: string }, key: string) {
      return `${key}:${this.value}`;
    });
    const value = { value: 'payload', toJSON };

    initGlobalSnapshotPatch();
    const first = new BackgroundSnapshotInstance('view');
    first.setAttribute('values', [value]);
    const second = new BackgroundSnapshotInstance('view');
    second.setAttribute('values', [value]);
    const third = new BackgroundSnapshotInstance('view');
    third.setAttribute('values', [value]);
    const patch = takeGlobalSnapshotPatch()!;

    expect(JSON.stringify(patch)).toContain('"0:payload"');
    expect(toJSON).toHaveBeenCalledWith('0');
    expect(patch).toContain(SnapshotOperation.CreateElementByTypeIndex);
  });
});
