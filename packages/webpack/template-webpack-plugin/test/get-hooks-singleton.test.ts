// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { LynxTemplatePlugin } from '../src/index.js';
import { getHooksFromSecondInstance } from './fixtures/template-plugin-second-instance.js';

describe('LynxTemplatePlugin.getLynxTemplatePluginHooks - cross-module singleton', () => {
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

  test('real instance writes first, second physical copy reads the same hooks', () => {
    const compilation = {} as Record<symbol, unknown>;
    const hooksReal = LynxTemplatePlugin
      .getLynxTemplatePluginHooks(compilation as never);
    const hooksSecond = getHooksFromSecondInstance(compilation);
    expect(hooksSecond).toBe(hooksReal);
  });

  test('second physical copy writes first, real instance reads the same hooks', () => {
    const compilation = {} as Record<symbol, unknown>;
    const hooksSecond = getHooksFromSecondInstance(compilation);
    const hooksReal = LynxTemplatePlugin
      .getLynxTemplatePluginHooks(compilation as never);
    expect(hooksReal).toBe(hooksSecond);
  });

  test('a tap registered through one copy fires when encode.promise is awaited through the other', async () => {
    const compilation = {} as Record<symbol, unknown>;
    const hooksReal = LynxTemplatePlugin
      .getLynxTemplatePluginHooks(compilation as never);

    const sentinel = {
      buffer: Buffer.from('ok'),
      debugInfo: '',
      cssDiagnostics: '',
    };
    hooksReal.encode.tapPromise(
      { name: 'tap-from-real-instance', stage: 0 },
      async () => sentinel,
    );

    const hooksSecond = getHooksFromSecondInstance(compilation);
    const result = await (hooksSecond.encode as unknown as {
      promise: (args: unknown) => Promise<unknown>;
    }).promise({
      encodeOptions: {},
      intermediate: '.rspeedy',
    });
    expect(result).toBe(sentinel);
  });
});
