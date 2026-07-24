/*
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { elementTree } from './utils/nativeMethod';
import { globalEnvManager } from './utils/envManager';
import { setupPage } from '../../src/snapshot';
import { __root } from '../../src/root';

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
});

beforeEach(() => {
  globalEnvManager.resetEnv();
});

afterEach(() => {
  delete globalThis.__ENABLE_MTS_RENDERING__;
  elementTree.clear();
});

describe('__ENABLE_MTS_RENDERING__', () => {
  it('should skip first-screen rendering when disabled', () => {
    globalThis.__ENABLE_MTS_RENDERING__ = false;
    __root.__jsx = (
      <view>
        <text>Hello</text>
      </view>
    );
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      />
    `);
  });

  it('should render the first screen when enabled', () => {
    globalThis.__ENABLE_MTS_RENDERING__ = true;
    __root.__jsx = (
      <view>
        <text>Hello</text>
      </view>
    );
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text>
            <raw-text
              text="Hello"
            />
          </text>
        </view>
      </page>
    `);
  });
});
