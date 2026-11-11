// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { CatalogFunctionEntry } from '../catalog/defineCatalog.js';

/** Additional functions in the Lynx catalog, distinct from the official basic catalog. */
export const extraFunctions: readonly CatalogFunctionEntry[] = [
  ...Object.entries({
    add: (a: number, b: number) => a + b,
    subtract: (a: number, b: number) => a - b,
    multiply: (a: number, b: number) => a * b,
    divide: (a: number, b: number) => a / b,
    greater_than: (a: number, b: number) => a > b,
    less_than: (a: number, b: number) => a < b,
  }).map(([name, impl]): CatalogFunctionEntry => ({
    kind: 'function',
    name,
    impl: args => impl(args['a'] as number, args['b'] as number),
    definition: {
      name,
      returnType: name.endsWith('_than') ? 'boolean' : 'number',
      parameters: {
        type: 'object',
        properties: {
          a: { $ref: 'common_types.json#/$defs/DynamicNumber' },
          b: { $ref: 'common_types.json#/$defs/DynamicNumber' },
        },
        required: ['a', 'b'],
        additionalProperties: false,
      },
    },
  })),
  ...Object.entries({
    equals: (a: unknown, b: unknown) => a === b,
    not_equals: (a: unknown, b: unknown) => a !== b,
  }).map(([name, impl]): CatalogFunctionEntry => ({
    kind: 'function',
    name,
    impl: args => impl(args['a'], args['b']),
    definition: {
      name,
      returnType: 'boolean',
      parameters: {
        type: 'object',
        properties: { a: {}, b: {} },
        required: ['a', 'b'],
        additionalProperties: false,
      },
    },
  })),
  ...Object.entries({
    contains: (value: string, search: string) => value.includes(search),
    starts_with: (value: string, search: string) => value.startsWith(search),
    ends_with: (value: string, search: string) => value.endsWith(search),
  }).map(([name, impl]): CatalogFunctionEntry => ({
    kind: 'function',
    name,
    impl: args => impl(args['value'] as string, args['search'] as string),
    definition: {
      name,
      returnType: 'boolean',
      parameters: {
        type: 'object',
        properties: { value: { type: 'string' }, search: { type: 'string' } },
        required: ['value', 'search'],
        additionalProperties: false,
      },
    },
  })),
];
