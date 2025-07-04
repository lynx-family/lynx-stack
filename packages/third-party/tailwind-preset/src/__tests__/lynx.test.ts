// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it, vi } from 'vitest';

import { LYNX_PLUGIN_MAP, getReplaceablePlugins } from '../core.js';
import preset, { createLynxPreset } from '../lynx.js';

describe('createLynxPreset', () => {
  it('returns a valid Tailwind config structure by default', () => {
    const result = createLynxPreset();
    expect(result).toHaveProperty('plugins');
    expect(result).toHaveProperty('corePlugins');
    expect(result).toHaveProperty('theme');
  });

  it('includes all replaceable plugins by default', () => {
    const result = createLynxPreset();
    const enabled = getReplaceablePlugins();

    for (const pluginName of enabled) {
      const plugin = LYNX_PLUGIN_MAP[pluginName];
      expect(result.plugins).toContain(plugin);
    }
  });

  it('respects the lynxPlugins allowed list', () => {
    const result = createLynxPreset({ lynxPlugins: ['transform'] });
    expect(result.plugins).toContain(LYNX_PLUGIN_MAP.transform);
    expect(result.plugins).not.toContain(LYNX_PLUGIN_MAP.rotate);
  });

  it('merges user theme overrides', () => {
    const result = createLynxPreset({ theme: { zIndex: { foo: '999' } } });
    const zIndex = result.theme?.zIndex as Record<string, string>;
    expect(zIndex['foo']).toBe('999');
  });

  it('invokes console.debug when debug is true', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    createLynxPreset({ debug: true });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('default export (preset)', () => {
  it('is a valid Tailwind config object', () => {
    expect(preset).toHaveProperty('plugins');
    expect(preset).toHaveProperty('corePlugins');
    expect(preset).toHaveProperty('theme');
  });
});
