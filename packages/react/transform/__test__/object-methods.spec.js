// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it } from 'vitest';

import { transformReactLynx } from '../main.js';

const replacementCallback = () => 2;

function options(target) {
  return {
    mode: 'test',
    pluginName: '',
    filename: 'test.jsx',
    sourcemap: false,
    cssScope: false,
    shake: false,
    compat: false,
    refresh: false,
    defineDCE: false,
    directiveDCE: false,
    worklet: {
      target,
      filename: 'test.jsx',
      runtimePkg: '@lynx-js/react/internal',
    },
  };
}

describe('object method captures', () => {
  it('captures nested computed keys in the enclosing worklet scope', async () => {
    const result = await transformReactLynx(
      `
      const name = 'create';
      const nestedName = 'read';
      export const valueType = {
        [name]() {
          'main thread';
          return { [nestedName](nestedName) { return nestedName; } };
        },
      };
      `,
      options('LEPUS'),
    );
    const functions = new Map();
    const valueType = new Function(
      '__loadWorkletRuntime',
      'registerWorkletInternal',
      `${result.code.replace(/^import .*;$/gm, '').replace(/^export /gm, '')}\nreturn valueType;`,
    )(
      () => true,
      (_type, id, fn) => functions.set(id, fn),
    );
    expect(valueType.create._c).toEqual({ nestedName: 'read' });
    const nested = functions.get(valueType.create._wkltId).call(valueType.create);
    expect(nested.read(42)).toBe(42);
  });

  it('reads background callbacks from the actual object method receiver', async () => {
    const result = await transformReactLynx(
      `
      export const valueType = {
        callback: () => 1,
        create() {
          'main thread';
          runOnBackground(this.callback)();
        },
      };
      `,
      options('JS'),
    );
    const valueType = new Function(
      '__transformToWorklet',
      `${result.code.replace(/^import .*;$/gm, '').replace(/^export /gm, '')}\nreturn valueType;`,
    )(fn => fn);
    expect(valueType.create._jsFn._jsFn1).toBe(valueType.callback);
    valueType.callback = replacementCallback;
    expect(valueType.create._jsFn._jsFn1).toBe(replacementCallback);
    const other = { callback: () => 3 };
    expect(Object.getOwnPropertyDescriptor(valueType, 'create').get.call(other)._jsFn._jsFn1)
      .toBe(other.callback);
  });
});
