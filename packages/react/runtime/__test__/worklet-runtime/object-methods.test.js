// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License, Version 2.0 that can be found in the LICENSE file in the root directory.
import { afterEach, expect, it } from 'vitest';
import { transformReactLynxSync } from '@lynx-js/react-transform';

import { initApiEnv } from '../../src/worklet-runtime/api/lynxApi';
import { initWorklet } from '../../src/worklet-runtime/workletRuntime';

afterEach(() => {
  delete globalThis.lynxWorkletImpl;
});

it('resolves a compiler-generated object method through whole-object captures', () => {
  globalThis.SystemInfo = { lynxSdkVersion: '2.16' };
  initApiEnv();
  initWorklet();
  const result = transformReactLynxSync(
    `
    export const source = {
      value: 1,
      method() { 'main thread'; return this.value; },
    };
  `,
    {
      mode: 'test',
      pluginName: '',
      filename: 'method.js',
      sourcemap: false,
      cssScope: false,
      shake: false,
      compat: false,
      refresh: false,
      defineDCE: { define: {} },
      directiveDCE: { target: 'LEPUS' },
      snapshot: {
        preserveJsx: false,
        runtimePkg: '@lynx-js/react/internal',
        jsxImportSource: '@lynx-js/react/lepus',
        target: 'LEPUS',
        filename: 'method',
      },
      worklet: { target: 'LEPUS', filename: 'method.js', runtimePkg: '@lynx-js/react/internal' },
    },
  );
  const source = new Function(
    '__loadWorkletRuntime',
    'registerWorkletInternal',
    `${result.code.replace(/^import .*;$/gm, '').replace('export const source', 'const source')}\nreturn source;`,
  )(() => true, registerWorklet);
  registerWorklet('main-thread', 'parent', function() {
    return this._c.source.method;
  });
  const first = runWorklet({ _wkltId: 'parent', _c: { source } }, []);
  expect(first()).toBe(1);
  source.value = 2;
  const second = runWorklet({ _wkltId: 'parent', _c: { source } }, []);
  expect(second()).toBe(2);
  expect(first()).toBe(1);
  expect(Object.getOwnPropertyDescriptor(source, 'method').get).toBeTypeOf('function');
});
