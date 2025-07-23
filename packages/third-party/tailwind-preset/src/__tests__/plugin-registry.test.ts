// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { assertType, describe, expect, it } from 'vitest';

import type { Plugin } from '../helpers.js';
import * as P from '../plugins/lynx/index.js';
import {
  LYNX_PLUGIN_ENTRIES,
  LYNX_PLUGIN_MAP,
} from '../plugins/lynx/plugin-registry.js';
import type { LynxPluginName } from '../plugins/lynx/plugin-types.js';

describe('LYNX_PLUGIN_REGISTRY consistency checks', () => {
  /** Every entry must point to the correct implementation in `index.ts`. */
  it('LYNX_PLUGIN_ENTRIES maps to the correct plugin implementations', () => {
    for (const [name, plugin] of LYNX_PLUGIN_ENTRIES) {
      // 1. Ensure the named export actually exists.
      expect((P as Record<LynxPluginName, Plugin>)[name]).toBeDefined();

      // 2. Ensure the mapping is correct (common copy‑paste error).
      expect(plugin).toBe((P as Record<LynxPluginName, Plugin>)[name]);
    }
  });

  it('LYNX_PLUGIN_MAP values match their named exports', () => {
    for (
      const [name, plugin] of Object.entries(LYNX_PLUGIN_MAP) as [
        LynxPluginName,
        Plugin,
      ][]
    ) {
      expect(plugin).toBe((P as Record<LynxPluginName, Plugin>)[name]); // same reference
    }
  });

  /** No duplicate plugin names are allowed. */
  it('contains no duplicate plugin names', () => {
    const names = LYNX_PLUGIN_ENTRIES.map(([n]) => n);
    expect(new Set(names).size).toBe(names.length);
  });

  /** Type-level check: keys of MAP cover every LynxPluginName. */
  it('type-level: LYNX_PLUGIN_MAP is keyed by all LynxPluginName', () => {
    assertType<Record<LynxPluginName, Plugin>>(LYNX_PLUGIN_MAP);
  });
});
