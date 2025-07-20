// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it, vi } from 'vitest';

import {
  autoBind,
  createPlugin,
  createPluginWithName,
  createUtilityPlugin,
  plugin,
  transformThemeValue,
} from '../helpers.js';
import type { RuntimePluginAPI } from './utils/mock-api.js';
import { mockPluginAPI } from './utils/mock-api.js';
import type { Bound } from '../types/plugin-types.js';
import type { PluginAPI } from '../types/tailwind-types.js';

describe('helpers.ts', () => {
  /* ------------------------------------------------------------------ *
   *  Public surface                                                    *
   * ------------------------------------------------------------------ */
  it('should expose createPlugin as a function', () => {
    expect(typeof createPlugin).toBe('function');
  });

  it('should expose createPluginWithName as a function', () => {
    expect(typeof createPluginWithName).toBe('function');
  });

  it('should expose plugin as a function', () => {
    expect(typeof plugin).toBe('function');
  });

  it('plugin exposes withOptions as a function', () => {
    expect(typeof plugin.withOptions).toBe('function');
  });

  it('should expose createUtilityPlugin as a function', () => {
    expect(typeof createUtilityPlugin).toBe('function');
  });

  it('should expose transformThemeValue as a function', () => {
    expect(typeof transformThemeValue).toBe('function');
  });

  /* ------------------------------------------------------------------ *
   *  createPlugin                                                      *
   * ------------------------------------------------------------------ */
  it('createPlugin should invoke the provided function with bound API', () => {
    const mockFn = vi.fn<(api: Bound<PluginAPI>) => void>();
    const pluginObj = createPlugin(mockFn);

    const api: RuntimePluginAPI = mockPluginAPI({
      config: vi.fn().mockReturnValue(true),
    });

    pluginObj.handler(api);
    expect(mockFn).toHaveBeenCalled();
  });

  /* ------------------------------------------------------------------ *
   *  createPluginWithName                                              *
   * ------------------------------------------------------------------ */
  it('createPluginWithName should NOT invoke the function when the core plugin is disabled', () => {
    const mockFn = vi.fn();
    const pluginObj = createPluginWithName('myPlugin', mockFn);

    const api = mockPluginAPI({
      config: vi.fn((key?: string) =>
        key === 'corePlugins.myPlugin' ? false : undefined
      ),
    });

    pluginObj.handler(api);
    expect(mockFn).not.toHaveBeenCalled();
  });

  it('createPluginWithName should invoke the function when the core plugin is enabled', () => {
    const mockFn = vi.fn();
    const pluginObj = createPluginWithName('myPlugin', mockFn);

    const api = mockPluginAPI({
      config: vi.fn((key?: string) =>
        key === 'corePlugins.myPlugin' ? true : undefined
      ),
    });

    pluginObj.handler(api);
    expect(mockFn).toHaveBeenCalled();
  });

  /* ------------------------------------------------------------------ *
   *  plugin() and plugin.withOptions()                                 *
   * ------------------------------------------------------------------ */
  it('plugin should call the bound plugin function with the API', () => {
    const mockFn = vi.fn();
    const pluginObj = plugin(mockFn);

    pluginObj.handler(mockPluginAPI());
    expect(mockFn).toHaveBeenCalled();
  });

  it('plugin.withOptions should call the factory and return a plugin that works', () => {
    const pluginFactory = vi.fn((options: { foo: number }) => {
      return vi.fn((api: Bound<PluginAPI>) => {
        expect(options.foo).toBe(1);
        expect(typeof api.config).toBe('function');
      });
    });

    const optionsPlugin = plugin.withOptions(pluginFactory);
    expect(optionsPlugin.__isOptionsFunction).toBe(true);

    const result = optionsPlugin({ foo: 1 });
    result.handler(mockPluginAPI()); // mockPluginAPI returns a superset (RuntimePluginAPI)

    expect(pluginFactory).toHaveBeenCalledWith({ foo: 1 });
  });

  it('plugin.withOptions passes options to cfgFactory and attaches config', () => {
    const pluginFactory = vi.fn(() => vi.fn());
    const cfgFactory = vi.fn((opt: { env: string }) => ({ env: opt.env }));

    const optionsPlugin = plugin.withOptions(pluginFactory, cfgFactory);
    const result = optionsPlugin({ env: 'test' });

    expect(result.config).toEqual({ env: 'test' });
    expect(cfgFactory).toHaveBeenCalledWith({ env: 'test' });
  });
});

describe('Bound + autoBind', () => {
  interface API {
    x: number;
    greet(this: API): string;
    echo(msg: string): string;
  }

  const impl: API = {
    x: 1,
    greet() {
      return `hi ${this.x}`;
    },
    echo(msg) {
      return msg;
    },
  };

  const bound = autoBind(impl) as Bound<API>;

  it('preserves non-function values', () => {
    expect(bound.x).toBe(1);
  });

  it('preserves callability for plain functions', () => {
    expect(bound.echo('yo')).toBe('yo');
  });

  it('fails without autoBind for `this`-dependent methods', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const { greet } = impl;
    // Intentionally calling an unbound method to confirm that `this` is lost
    expect(() => (greet as (this: unknown) => string)()).toThrow(TypeError);
  });
  it('can be destructured without losing context', () => {
    const { echo } = bound;
    expect(echo('test')).toBe('test');
  });
});
