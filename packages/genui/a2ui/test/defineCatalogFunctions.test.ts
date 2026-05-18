// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import {
  defineCatalog,
  defineFunction,
  mergeCatalogs,
  serializeCatalog,
} from '../src/catalog/defineCatalog.js';
import { functionRegistry } from '../src/store/FunctionRegistry.js';

function MockComponent(): null {
  return null;
}
MockComponent.displayName = 'MockComponent';

function namedImpl(args: Record<string, unknown>): unknown {
  return args['value'];
}
Object.defineProperty(namedImpl, 'name', { value: 'pickValue' });

function laterImpl(args: Record<string, unknown>): unknown {
  return args['value'];
}

const requiredManifest = {
  required: {
    name: 'required',
    parameters: { type: 'object', properties: { value: { type: 'string' } } },
    returnType: 'boolean' as const,
  },
};

describe('defineCatalog with function entries', () => {
  test('separates components and functions', () => {
    const catalog = defineCatalog([
      MockComponent,
      defineFunction(namedImpl, requiredManifest),
    ]);

    expect(catalog.components.map(c => c.name)).toEqual(['MockComponent']);
    expect(catalog.functions.map(f => f.name)).toEqual(['required']);
    expect(functionRegistry.has('required')).toBe(true);
  });

  test('rejects duplicate function names', () => {
    expect(() =>
      defineCatalog([
        defineFunction(namedImpl, requiredManifest),
        defineFunction(namedImpl, requiredManifest),
      ])
    ).toThrow(/Duplicate function name/);
  });

  test('serializeCatalog announces functions in the handshake', () => {
    const catalog = defineCatalog([
      MockComponent,
      defineFunction(namedImpl, requiredManifest),
    ]);

    const serialized = serializeCatalog(catalog);
    expect(serialized.version).toBe('0.9');
    expect(serialized.components).toEqual([{ name: 'MockComponent' }]);
    expect(serialized.functions).toEqual([
      requiredManifest.required,
    ]);
  });

  test('serializeCatalog omits functions array when definitions are absent', () => {
    const catalog = defineCatalog([MockComponent, defineFunction(namedImpl)]);
    const serialized = serializeCatalog(catalog);
    expect(serialized.functions).toBeUndefined();
  });

  test('mergeCatalogs preserves functions and re-registers impls', () => {
    const a = defineCatalog([defineFunction(namedImpl, requiredManifest)]);
    const b = defineCatalog([
      {
        kind: 'function' as const,
        name: 'required',
        impl: laterImpl,
        definition: requiredManifest.required,
      },
    ]);

    const merged = mergeCatalogs(a, b);
    expect(merged.functions).toHaveLength(1);
    expect(merged.functions[0]!.impl).toBe(laterImpl);
    expect(functionRegistry.resolve('required')).toBe(laterImpl);
  });

  test('defineFunction without a manifest reads the impl name', () => {
    const entry = defineFunction(namedImpl);
    expect(entry.name).toBe('pickValue');
    expect(entry.definition).toBeUndefined();
  });
});
