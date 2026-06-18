// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';
import { describe, expect, it, rstest } from '@rstest/core';

import {
  autoBind,
  createPlugin,
  createUtilityPlugin,
  TW_NO_PREFIX,
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

  it('createPlugin exposes withOptions as a function', () => {
    expect(typeof createPlugin.withOptions).toBe('function');
  });

  it('should expose createUtilityPlugin as a function', () => {
    expect(typeof createUtilityPlugin).toBe('function');
  });

  it('should expose transformThemeValue as a function', () => {
    expect(typeof transformThemeValue).toBe('function');
  });
});

describe('createPlugin', () => {
  /* ------------------------------------------------------------------ *
   *  createPlugin                                                      *
   * ------------------------------------------------------------------ */
  it('createPlugin should invoke the provided function with bound API', () => {
    const mockFn = rstest.fn<(api: Bound<PluginAPI>) => void>();
    const pluginObj = createPlugin(mockFn);

    const api: RuntimePluginAPI = mockPluginAPI({
      config: rstest.fn().mockReturnValue(true),
    });

    pluginObj.handler(api);
    expect(mockFn).toHaveBeenCalled();
  });

  /* ------------------------------------------------------------------ *
   *  createPlugin.withOptions()                                 *
   * ------------------------------------------------------------------ */

  it('createPlugin.withOptions should call the factory and return a plugin that works', () => {
    const pluginFactory = rstest.fn((options?: { foo: number }) => {
      return rstest.fn((api: Bound<PluginAPI>) => {
        expect(options?.foo).toBe(1);
        expect(typeof api.config).toBe('function');
      });
    });

    const optionsPlugin = createPlugin.withOptions(pluginFactory);
    expect(optionsPlugin.__isOptionsFunction).toBe(true);

    const result = optionsPlugin({ foo: 1 });
    result.handler(mockPluginAPI()); // mockPluginAPI returns a superset (RuntimePluginAPI)

    expect(pluginFactory).toHaveBeenCalledWith({ foo: 1 });
  });

  it('createPlugin.withOptions passes options to cfgFactory and attaches config', () => {
    const pluginFactory = rstest.fn(() => rstest.fn());
    const cfgFactory = rstest.fn((opt?: { env: string }) => ({
      env: opt?.env,
    }));

    const optionsPlugin = createPlugin.withOptions(pluginFactory, cfgFactory);
    const result = optionsPlugin({ env: 'test' });

    result.handler(mockPluginAPI());

    expect(result.config).toEqual({ env: 'test' });
    expect(cfgFactory).toHaveBeenCalledWith({ env: 'test' });
  });

  it('createPlugin.withOptions works when no options are passed', () => {
    const pluginFactory = rstest.fn(() => rstest.fn());
    const configFactory = rstest.fn(() => ({ foo: 'bar' }));

    const plugin = createPlugin.withOptions(pluginFactory, configFactory);
    const result = plugin(); // no options passed
    result.handler(mockPluginAPI());

    expect(result.handler).toBeInstanceOf(Function);
    expect(result.config).toEqual({ foo: 'bar' });

    expect(pluginFactory).toHaveBeenCalledWith(undefined);
    expect(configFactory).toHaveBeenCalledWith(undefined);
  });
});

describe('autoBind', () => {
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

  const bound = autoBind(impl);

  it('preserves non-function values', () => {
    expect(bound.x).toBe(1);
  });

  it('preserves callability for plain functions', () => {
    expect(bound.echo('yo')).toBe('yo');
  });

  it('autoBind fails with `this`-dependent methods', () => {
    const { greet } = bound;
    // Intentionally calling an unbound method to confirm that `this` is lost
    expect(() => (greet as (this: unknown) => string)()).toThrow(TypeError);
  });

  it('`this`-independent methods can be destructured without losing context', () => {
    const { echo } = bound;
    expect(echo('test')).toBe('test');
  });
});

describe('TW_NO_PREFIX', () => {
  it('should be an object with a symbol key from setupContextUtils.INTERNAL_FEATURES', () => {
    // TW_NO_PREFIX must have exactly one symbol key whose value is { respectPrefix: false }
    const symKeys = Object.getOwnPropertySymbols(TW_NO_PREFIX);
    expect(symKeys).toHaveLength(1);

    const value = (TW_NO_PREFIX as Record<symbol, unknown>)[symKeys[0]!];
    expect(value).toEqual({ respectPrefix: false });
  });

  it('symbol key matches tailwindcss INTERNAL_FEATURES', () => {
    // Verify the symbol is the same one exported by tailwindcss
    const require = createRequire(import.meta.url);
    const mod = require('tailwindcss/lib/lib/setupContextUtils.js') as Record<
      string,
      unknown
    >;
    const INTERNAL_FEATURES = mod['INTERNAL_FEATURES'] as symbol;

    expect(INTERNAL_FEATURES).toBeDefined();
    expect(typeof INTERNAL_FEATURES).toBe('symbol');

    const symKeys = Object.getOwnPropertySymbols(TW_NO_PREFIX);
    expect(symKeys[0]).toBe(INTERNAL_FEATURES);
  });
});
