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
      '__registerWorklet',
      `${result.code.replace(/^import .*;$/gm, '').replace(/^export /gm, '')}\nreturn valueType;`,
    )(
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

  it('preserves nullish bases and guards when narrowing optional member captures', async () => {
    const result = await transformReactLynx(
      `
      export function create(enabled, handlers) {
        return () => {
          'main thread';
          if (enabled && handlers?.start) handlers.start();
        };
      }

      export function createNested(enabled, handlers) {
        return () => {
          'main thread';
          if (enabled && handlers?.nested?.start) handlers.nested.start();
        };
      }
      `,
      options('LEPUS'),
    );
    const functions = new Map();
    const { create, createNested } = new Function(
      '__registerWorklet',
      '__captureMainThreadObject',
      `${result.code.replace(/^import .*;$/gm, '').replace(/^export /gm, '')}\nreturn { create, createNested };`,
    )(
      (_type, id, fn) => functions.set(id, fn),
      () => undefined,
    );
    const invoke = worklet => functions.get(worklet._wkltId).call(worklet);

    const withNullDisabled = create(false, null);
    expect(withNullDisabled._c.handlers).toBeNull();
    expect(() => invoke(withNullDisabled)).not.toThrow();

    const withUndefinedDisabled = create(false, undefined);
    expect(withUndefinedDisabled._c.handlers).toBeUndefined();
    expect(() => invoke(withUndefinedDisabled)).not.toThrow();

    const withNullEnabled = create(true, null);
    expect(withNullEnabled._c.handlers).toBeNull();
    expect(() => invoke(withNullEnabled)).not.toThrow();

    const withUndefinedEnabled = create(true, undefined);
    expect(withUndefinedEnabled._c.handlers).toBeUndefined();
    expect(() => invoke(withUndefinedEnabled)).not.toThrow();

    let started = 0;
    const handlers = {
      start() {
        started += 1;
      },
      extra: 'unreferenced',
    };
    const withHandlersDisabled = create(false, handlers);
    expect(withHandlersDisabled._c.handlers).toEqual({ start: handlers.start });
    expect('extra' in withHandlersDisabled._c.handlers).toBe(false);
    invoke(withHandlersDisabled);
    expect(started).toBe(0);

    const withHandlersEnabled = create(true, handlers);
    invoke(withHandlersEnabled);
    expect(started).toBe(1);

    const withNestedNull = createNested(true, { nested: null, extra: 1 });
    expect(withNestedNull._c.handlers).toEqual({ nested: null });
    expect(() => invoke(withNestedNull)).not.toThrow();

    const withNestedUndefined = createNested(true, { nested: undefined, extra: 1 });
    expect(withNestedUndefined._c.handlers).toEqual({ nested: undefined });
    expect(() => invoke(withNestedUndefined)).not.toThrow();

    const withNestedHandlers = createNested(true, { nested: handlers, extra: 1 });
    expect(withNestedHandlers._c.handlers).toEqual({
      nested: { start: handlers.start },
    });
    invoke(withNestedHandlers);
    expect(started).toBe(2);
  });
});
