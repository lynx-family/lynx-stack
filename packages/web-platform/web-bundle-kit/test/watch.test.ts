// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, rstest, test } from '@rstest/core';

import { ChangeWatchFileSystem } from '../src/watch.js';

function setup() {
  const purge = rstest.fn();
  const wfs = new ChangeWatchFileSystem({ inputFileSystem: { purge } });
  const watch = () => {
    const callback = rstest.fn();
    const undelayed = rstest.fn();
    const watcher = wfs.watch([], [], [], 0, {}, callback, undelayed);
    return { callback, undelayed, watcher };
  };
  return { wfs, purge, watch };
}

describe('ChangeWatchFileSystem', () => {
  test('one notify while watching makes one callback', () => {
    const { wfs, purge, watch } = setup();
    const { callback, undelayed } = watch();
    wfs.notify(['/p/a.ts'], ['/p/b.ts']);
    expect(purge).toHaveBeenCalledTimes(1);
    expect(undelayed).toHaveBeenCalledWith('/p/a.ts', expect.any(Number));
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0]!.slice(3)).toEqual([
      new Set(['/p/a.ts']),
      new Set(['/p/b.ts']),
    ]);
    // The watcher is used up: a second notify waits for the next watch().
    wfs.notify(['/p/c.ts'], []);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('changes during a compilation are merged and start the next one', async () => {
    const { wfs, watch } = setup();
    wfs.notify(['/p/a.ts'], []);
    wfs.notify([], ['/p/a.ts']);
    wfs.notify(['/p/b.ts'], []);
    const { callback } = watch();
    expect(callback).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0]!.slice(3)).toEqual([
      new Set(['/p/b.ts']),
      new Set(['/p/a.ts']),
    ]);
  });

  test('a closed or paused watcher is not called', () => {
    const { wfs, watch } = setup();
    const first = watch();
    first.watcher.close();
    wfs.notify(['/p/a.ts'], []);
    expect(first.callback).not.toHaveBeenCalled();
    const second = watch();
    second.watcher.pause();
    return Promise.resolve().then(() => {
      expect(second.callback).toHaveBeenCalledTimes(0);
    });
  });

  test('getInfo reports pending changes', () => {
    const { wfs, watch } = setup();
    const { watcher } = watch();
    watcher.pause();
    wfs.notify(['/p/a.ts'], []);
    expect(watcher.getInfo().changes).toEqual(new Set(['/p/a.ts']));
  });
});
