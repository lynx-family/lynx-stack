// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { LynxTemplatePlugin } from '../src/index.js';

// When two copies of `@lynx-js/template-webpack-plugin` end up at distinct
// physical paths under `node_modules` (npm hoist conflict, file:/link:
// nesting, etc.), Node's ESM loader treats them as two module instances.
// A module-scoped `WeakMap` stash would then double up: taps registered
// through one copy of `LynxTemplatePlugin` are invisible to
// `hooks.encode.promise()` invoked through the other copy, and the bail
// hook resolves with `undefined` — which downstream code destructures.
//
// The fix routes storage through a `Symbol.for(...)` key stashed on the
// `compilation` itself. The same key resolves to the same symbol across
// all module instances in the realm, so any copy of the plugin sees the
// same hooks for a given compilation. These tests assert that contract.
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

  test('hooks created by one module instance are visible to another via Symbol.for key', () => {
    // Simulate a second module instance of `@lynx-js/template-webpack-plugin`
    // (as would happen when npm puts two copies at different physical paths
    // under node_modules). The second instance would have its own module-level
    // storage; the only reliable cross-instance shared state is `Symbol.for`.
    const compilation = {} as Record<symbol, unknown>;
    const hooksFromRealInstance = LynxTemplatePlugin
      .getLynxTemplatePluginHooks(compilation as never);

    // A second module instance, given the same compilation, should resolve
    // the same hooks via the well-known Symbol.for slot.
    const hooksFromSecondInstance = compilation[SHARED_KEY];
    expect(hooksFromSecondInstance).toBe(hooksFromRealInstance);
  });

  test('a tap registered through any instance is observed when encode.promise is awaited through another', async () => {
    // Build a fresh compilation. First "instance" registers a tap on encode.
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

    // Second "instance" resolves hooks from the same compilation. Because
    // storage is keyed by `Symbol.for` on the compilation, both instances see
    // the identical hooks — the tap from A is reachable from B.
    const hooksB = compilation[SHARED_KEY] as typeof hooksA;
    expect(hooksB).toBe(hooksA);

    const result = await hooksB.encode.promise({
      // The bail handler returns immediately on the sentinel, so the runtime
      // shape of these arguments is irrelevant.
      encodeOptions: {} as never,
      intermediate: '.rspeedy',
    });
    expect(result).toBe(sentinel);
  });
});
