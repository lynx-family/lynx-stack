// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it } from 'vitest';

import { captureMainThreadObject } from '../../runtime/src/core/capture-main-thread-object.js';
import { registerMainThreadObjectHandle } from '../../runtime/src/core/main-thread-object-handle-registry.js';
import { transformReactLynx } from '../main.js';

async function compile(target, helper) {
  const result = await transformReactLynx(
    `
    export function create(rect) {
      return () => {
        'main thread';
        return rect.top + rect.bottom;
      };
    }
    export function createNested(props) {
      return () => {
        'main thread';
        return props?.rect?.top;
      };
    }
    `,
    {
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
    },
  );
  expect(result.errors).toEqual([]);
  const functions = new Map();
  const factories = new Function(
    '__registerWorklet',
    '__captureMainThreadObject',
    `${result.code.replace(/^import .*;$/gm, '').replace(/^export /gm, '')}
    return { create, createNested };`,
  )(
    (_type, id, fn) => functions.set(id, fn),
    helper,
  );
  return {
    ...factories,
    invoke: worklet => functions.get(worklet._wkltId).call(worklet),
  };
}

describe.each(['JS', 'LEPUS', 'MIXED'])('MTO helper compatibility (%s)', target => {
  it.each([undefined, null, captureMainThreadObject])(
    'keeps ordinary MTS captures working with helper %s',
    async helper => {
      const { create, createNested, invoke } = await compile(target, helper);
      const worklet = create({ top: 10, bottom: 20, unused: 30 });
      expect(worklet._c).toEqual({ rect: { top: 10, bottom: 20 } });

      let reads = 0;
      const nested = createNested({
        get rect() {
          reads += 1;
          return { top: 42, unused: 99 };
        },
      });
      expect(reads).toBe(1);
      expect(nested._c).toEqual({ props: { rect: { top: 42 } } });
      expect(createNested(null)._c.props).toBeNull();
      expect(createNested(undefined)._c.props).toBeUndefined();
      expect(createNested({ rect: null })._c.props.rect).toBeNull();
      expect(createNested({ rect: undefined })._c.props.rect).toBeUndefined();

      if (target !== 'JS') {
        expect(invoke(worklet)).toBe(30);
        expect(invoke(nested)).toBe(42);
        expect(invoke(createNested(null))).toBeUndefined();
        expect(invoke(createNested({ rect: null }))).toBeUndefined();
      }
    },
  );

  it('preserves registered MTO handles without reading their properties', async () => {
    const { create, createNested } = await compile(target, captureMainThreadObject);
    const handle = Object.defineProperties({}, {
      top: {
        get() {
          throw new Error('opaque handle must not be read');
        },
      },
      bottom: {
        get() {
          throw new Error('opaque handle must not be read');
        },
      },
    });
    registerMainThreadObjectHandle(handle, 'compat-test');
    expect(create(handle)._c.rect).toBe(handle);
    expect(createNested({ rect: handle })._c.props.rect).toBe(handle);
  });
});
