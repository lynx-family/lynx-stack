/*
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
/** @jsxImportSource ../../../lepus */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ENTRY_RELOADER } from '../../../src/core/entry-reloader';
import { __root } from '../../../src/root';
import { setupPage } from '../../../src/snapshot';
import { globalEnvManager } from '../utils/envManager';
import { elementTree } from '../utils/nativeMethod';

function First() {
  return (
    <view>
      <text>first</text>
    </view>
  );
}

function Second() {
  return (
    <view>
      <text>second</text>
    </view>
  );
}

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
});

beforeEach(() => {
  globalEnvManager.resetEnv();
  globalEnvManager.switchToMainThread();
});

afterEach(() => {
  delete globalThis[ENTRY_RELOADER];
  vi.restoreAllMocks();
  globalEnvManager.resetEnv();
  elementTree.clear();
});

describe('reloadTemplate entry reloader', () => {
  it('reuses the previous jsx when no reloader is installed', () => {
    __root.__jsx = <First />;
    renderPage();

    updatePage({}, { reloadTemplate: true });

    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text>
            <raw-text
              text="first"
            />
          </text>
        </view>
      </page>
    `);
  });

  it('re-runs the entry and renders its jsx when a reloader is installed', () => {
    __root.__jsx = <First />;
    renderPage();

    const reloadEntry = vi.fn(() => {
      __root.__jsx = <Second />;
    });
    globalThis[ENTRY_RELOADER] = reloadEntry;

    updatePage({}, { reloadTemplate: true });

    expect(reloadEntry).toHaveBeenCalledTimes(1);
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text>
            <raw-text
              text="second"
            />
          </text>
        </view>
      </page>
    `);
  });
});
