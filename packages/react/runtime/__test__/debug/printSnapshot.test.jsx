/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { backgroundSnapshotInstanceManager, snapshotInstanceManager } from '../../src/snapshot';
import { elementTree } from '../utils/nativeMethod';
import { BackgroundSnapshotInstance } from '../../src/backgroundSnapshot';
import { printSerializedSnapshotInstance, printSnapshotInstance } from '../../src/debug/printSnapshot';
import { SnapshotInstance } from '../../src/snapshot';

const HOLE = null;

beforeEach(() => {
  backgroundSnapshotInstanceManager.clear();
  snapshotInstanceManager.clear();
});

afterEach(() => {
  elementTree.clear();
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
    <text text={HOLE}></text>
    <text text={HOLE}></text>
  </view>,
);

describe('printSnapshotInstance', () => {
  let msg;
  let log = x => {
    msg += x + '\n';
  };

  beforeEach(() => {
    msg = '\n';
  });

  it('basic', async function() {
    const bsi1 = new BackgroundSnapshotInstance(snapshot1);
    const bsi2 = new BackgroundSnapshotInstance(snapshot2);
    const bsi22 = new BackgroundSnapshotInstance(snapshot2);
    const bsi3 = new BackgroundSnapshotInstance(snapshot3);
    bsi1.insertBefore(bsi2);
    bsi1.insertBefore(bsi22);
    bsi2.insertBefore(bsi3);
    bsi3.setAttribute(0, 'attr 1');
    bsi3.setAttribute(1, 'attr 2');
    bsi3.setAttribute('__1', 'attr 2');
    printSnapshotInstance(bsi1, log);
    expect(msg).toMatchInlineSnapshot(`
      "
      | 1(__snapshot_a94a8_test_1): undefined
        | 2(__snapshot_a94a8_test_2): undefined
          | 4(__snapshot_a94a8_test_3): ["attr 1","attr 2"]
        | 3(__snapshot_a94a8_test_2): undefined
      "
    `);
  });

  it('SnapshotInstance', async function() {
    const si1 = new SnapshotInstance(snapshot1);
    const si2 = new SnapshotInstance(snapshot2);
    const si22 = new SnapshotInstance(snapshot2);
    const si3 = new SnapshotInstance(snapshot3);
    si1.insertBefore(si2);
    si1.insertBefore(si22);
    si2.insertBefore(si3);
    si3.setAttribute(0, 'attr 1');
    si3.setAttribute(1, 'attr 2');
    si3.setAttribute('__1', 'attr 2');
    printSnapshotInstance(si1, log);
    expect(msg).toMatchInlineSnapshot(`
      "
      | -2(__snapshot_a94a8_test_1): undefined
        | -3(__snapshot_a94a8_test_2): undefined
          | -5(__snapshot_a94a8_test_3): ["attr 1","attr 2"]
        | -4(__snapshot_a94a8_test_2): undefined
      "
    `);

    const serialized = JSON.stringify(si1);
    msg = '\n';
    printSerializedSnapshotInstance(JSON.parse(serialized), log);
    expect(msg).toMatchInlineSnapshot(`
      "
      | -2(__snapshot_a94a8_test_1): undefined
        | -3(__snapshot_a94a8_test_2): undefined
          | -5(__snapshot_a94a8_test_3): ["attr 1","attr 2"]
        | -4(__snapshot_a94a8_test_2): undefined
      "
    `);
  });

  it('printToScreen', async function() {
    const bsi1 = new BackgroundSnapshotInstance(snapshot1);
    const bsi2 = new BackgroundSnapshotInstance(snapshot2);
    const bsi22 = new BackgroundSnapshotInstance(snapshot2);
    const bsi3 = new BackgroundSnapshotInstance(snapshot3);
    bsi1.insertBefore(bsi2);
    bsi1.insertBefore(bsi22);
    bsi2.insertBefore(bsi3);
    bsi3.setAttribute(0, 'attr 1');
    bsi3.setAttribute(1, 'attr 2');
    printSnapshotInstance(bsi1);
    expect(msg).toMatchInlineSnapshot(`
      "
      "
    `);
  });

  it('printToScreen for SnapshotInstance', async function() {
    const si1 = new SnapshotInstance(snapshot1);
    const si2 = new SnapshotInstance(snapshot2);
    const si22 = new SnapshotInstance(snapshot2);
    const si3 = new SnapshotInstance(snapshot3);
    si1.insertBefore(si2);
    si1.insertBefore(si22);
    si2.insertBefore(si3);
    si3.setAttribute(0, 'attr 1');
    si3.setAttribute(1, 'attr 2');
    si3.setAttribute('__1', 'attr 2');
    printSnapshotInstance(si1);
    expect(msg).toMatchInlineSnapshot(`
      "
      "
    `);

    const serialized = JSON.stringify(si1);
    msg = '\n';
    printSerializedSnapshotInstance(JSON.parse(serialized));
    expect(msg).toMatchInlineSnapshot(`
      "
      "
    `);
  });
});
