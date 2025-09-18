// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it, vi } from 'vitest';

import {
  LYNX_PLUGIN_MAP,
  LYNX_UI_PLUGIN_MAP,
  ORDERED_LYNX_UI_PLUGIN_NAMES,
  getReplaceablePlugins,
} from '../core.js';
import type { LynxUIPluginOptionsMap } from '../core.js';
import preset, { createLynxPreset } from '../lynx.js';
import type { UIVariantsOptions } from '../plugins/lynx-ui/uiVariants.js';

const firstUIPlugin = ORDERED_LYNX_UI_PLUGIN_NAMES[0]!;
type FirstUIPluginOptions = LynxUIPluginOptionsMap[typeof firstUIPlugin];

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

describe('createLynxPreset - Lynx UI plugin behavior', () => {
  const firstUIPlugin = ORDERED_LYNX_UI_PLUGIN_NAMES[0]!;

  it('includes UI plugin if enabled (true)', () => {
    const spy = Object.assign(vi.fn(), { __isOptionsFunction: true as const });
    const original = LYNX_UI_PLUGIN_MAP[firstUIPlugin];

    // Mock the plugin function
    LYNX_UI_PLUGIN_MAP[firstUIPlugin] = spy;

    createLynxPreset({
      lynxUIPlugins: { [firstUIPlugin]: true },
    });

    expect(spy).toHaveBeenCalledWith({});
    LYNX_UI_PLUGIN_MAP[firstUIPlugin] = original; // restore
  });

  it('includes UI plugin if enabled with options', () => {
    const spy = Object.assign(vi.fn(), { __isOptionsFunction: true as const });
    const original = LYNX_UI_PLUGIN_MAP[firstUIPlugin];
    const mockOptions: FirstUIPluginOptions = { prefixes: ['bar'] };

    LYNX_UI_PLUGIN_MAP[firstUIPlugin] = spy;

    createLynxPreset({
      lynxUIPlugins: { [firstUIPlugin]: mockOptions },
    });

    expect(spy).toHaveBeenCalledWith(mockOptions);
    LYNX_UI_PLUGIN_MAP[firstUIPlugin] = original;
  });

  it('does not include UI plugin if disabled', () => {
    const spy = Object.assign(vi.fn(), { __isOptionsFunction: true as const });
    const original = LYNX_UI_PLUGIN_MAP[firstUIPlugin];

    LYNX_UI_PLUGIN_MAP[firstUIPlugin] = spy;

    createLynxPreset({
      lynxUIPlugins: { [firstUIPlugin]: false },
    });

    expect(spy).not.toHaveBeenCalled();
    LYNX_UI_PLUGIN_MAP[firstUIPlugin] = original;
  });

  it('does not include UI plugin if global UI plugins disabled', () => {
    const spy = Object.assign(vi.fn(), { __isOptionsFunction: true as const });
    const original = LYNX_UI_PLUGIN_MAP[firstUIPlugin];

    LYNX_UI_PLUGIN_MAP[firstUIPlugin] = spy;

    createLynxPreset({ lynxUIPlugins: false });

    expect(spy).not.toHaveBeenCalled();
    LYNX_UI_PLUGIN_MAP[firstUIPlugin] = original;
  });

  it('includes UI plugin when lynxUIPlugins = true (default options)', () => {
    const spy = Object.assign(vi.fn(), { __isOptionsFunction: true as const });
    const original = LYNX_UI_PLUGIN_MAP[firstUIPlugin];

    LYNX_UI_PLUGIN_MAP[firstUIPlugin] = spy;

    createLynxPreset({ lynxUIPlugins: true });

    expect(spy).toHaveBeenCalledWith({});
    LYNX_UI_PLUGIN_MAP[firstUIPlugin] = original;
  });

  it('prints debug info when UI plugin is enabled and debug is true', () => {
    const spy = Object.assign(vi.fn(), { __isOptionsFunction: true as const });

    const original = LYNX_UI_PLUGIN_MAP[firstUIPlugin];
    LYNX_UI_PLUGIN_MAP[firstUIPlugin] = spy;

    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    createLynxPreset({
      lynxUIPlugins: { [firstUIPlugin]: true },
      debug: true,
    });

    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `[Lynx] enabled UI plugin: ${firstUIPlugin}`,
      ),
    );
    LYNX_UI_PLUGIN_MAP[firstUIPlugin] = original;
    debugSpy.mockRestore();
  });

  it('enables uiVariants by default (no options passed)', () => {
    const handler = vi.fn();
    const pluginObject = { handler } as const;

    const spy = vi
      .spyOn(LYNX_UI_PLUGIN_MAP, 'uiVariants')
      .mockImplementation((_opts?: UIVariantsOptions) => pluginObject);

    try {
      const cfg = createLynxPreset();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({});

      expect(cfg.plugins).toEqual(
        expect.arrayContaining([expect.objectContaining({ handler })]),
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('does NOT enable uiVariants when explicitly disabled', () => {
    const spy = Object.assign(vi.fn(), { __isOptionsFunction: true as const });
    const original = LYNX_UI_PLUGIN_MAP.uiVariants;
    LYNX_UI_PLUGIN_MAP.uiVariants = spy;

    try {
      createLynxPreset({
        lynxUIPlugins: { uiVariants: false },
      });
      expect(spy).not.toHaveBeenCalled();
    } finally {
      LYNX_UI_PLUGIN_MAP.uiVariants = original;
    }
  });

  it('enables uiVariants by default even when lynxUIPlugins is an empty object', () => {
    const spy = Object.assign(vi.fn(), { __isOptionsFunction: true as const });
    const original = LYNX_UI_PLUGIN_MAP.uiVariants;
    LYNX_UI_PLUGIN_MAP.uiVariants = spy;

    try {
      createLynxPreset({ lynxUIPlugins: {} });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({});
    } finally {
      LYNX_UI_PLUGIN_MAP.uiVariants = original;
    }
  });
});

describe('createLynxPreset - defensive branches', () => {
  const firstUIPlugin = ORDERED_LYNX_UI_PLUGIN_NAMES[0]!;

  it('prints debug when invariant is broken (missing plugin impl)', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    const original = LYNX_UI_PLUGIN_MAP[firstUIPlugin];
    // Simulate missing plugin implementation
    (LYNX_UI_PLUGIN_MAP as unknown as Record<string, any>)[firstUIPlugin] =
      undefined;

    try {
      createLynxPreset({ debug: true });
      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `[Lynx] invariant: missing UI plugin impl for '${firstUIPlugin}'`,
        ),
      );
    } finally {
      // Restore original plugin implementation
      (LYNX_UI_PLUGIN_MAP as unknown as Record<string, any>)[firstUIPlugin] =
        original;
      debugSpy.mockRestore();
    }
  });

  it('logs warning when UI plugin throws during initialization', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const original = LYNX_UI_PLUGIN_MAP[firstUIPlugin];

    // Simulate plugin throwing an error
    (LYNX_UI_PLUGIN_MAP as unknown as Record<string, any>)[firstUIPlugin] =
      () => {
        throw new Error('boom');
      };

    try {
      createLynxPreset({
        lynxUIPlugins: { [firstUIPlugin]: true },
        debug: true,
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `[Lynx] failed to initialize UI plugin '${firstUIPlugin}'`,
        ),
        expect.any(Error),
      );
    } finally {
      // Restore original plugin implementation
      (LYNX_UI_PLUGIN_MAP as unknown as Record<string, any>)[firstUIPlugin] =
        original;
      warnSpy.mockRestore();
    }
  });
});
