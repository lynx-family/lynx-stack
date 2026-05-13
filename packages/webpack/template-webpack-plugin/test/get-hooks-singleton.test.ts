// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { LynxTemplatePlugin } from '../src/index.js';

describe('LynxTemplatePlugin.getLynxTemplatePluginHooks - cross-module singleton', () => {
  const SHARED_KEY = Symbol.for('@lynx-js/template-webpack-plugin/hooks');

  test('returns the same hooks for the same compilation across calls', () => {
    const compilation = {} as never;
    const a = LynxTemplatePlugin.getLynxTemplatePluginHooks(compilation);
    const b = LynxTemplatePlugin.getLynxTemplatePluginHooks(compilation);
    expect(b).toBe(a);
  });

  test('returns distinct hooks for distinct compilations', () => {
    const compilationA = {} as never;
    const compilationB = {} as never;
    const a = LynxTemplatePlugin.getLynxTemplatePluginHooks(compilationA);
    const b = LynxTemplatePlugin.getLynxTemplatePluginHooks(compilationB);
    expect(a).not.toBe(b);
  });

  // A second physical copy of this module would have its own module-level
  // storage; the shared `Symbol.for` slot on the compilation is what makes
  // them converge on the same hooks.
  test('hooks are reachable through the shared Symbol.for slot', () => {
    const compilation = {} as Record<symbol, unknown>;
    const hooksFromRealInstance = LynxTemplatePlugin
      .getLynxTemplatePluginHooks(compilation as never);
    expect(compilation[SHARED_KEY]).toBe(hooksFromRealInstance);
  });

  test('a tap registered through one instance fires when encode.promise is awaited through another', async () => {
    const compilation = {} as Record<symbol, unknown>;
    const hooksA = LynxTemplatePlugin
      .getLynxTemplatePluginHooks(compilation as never);

    const sentinel = {
      buffer: Buffer.from('ok'),
      debugInfo: '',
      cssDiagnostics: '',
    };
    hooksA.encode.tapPromise(
      { name: 'tap-from-instance-A', stage: 0 },
      async () => sentinel,
    );

    const hooksB = compilation[SHARED_KEY] as typeof hooksA;
    expect(hooksB).toBe(hooksA);

    const result = await hooksB.encode.promise({
      encodeOptions: {} as never,
      intermediate: '.rspeedy',
    });
    expect(result).toBe(sentinel);
  });
});
