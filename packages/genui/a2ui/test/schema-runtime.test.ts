// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { expect, test } from '@rstest/core';

test('built schema validation works without native host globals', () => {
  const schemaUrl = new URL('../dist/store/schema.js', import.meta.url).href;
  const source = readFileSync(new URL(schemaUrl), 'utf8');
  expect(source).not.toMatch(
    /\bBigInt\s*\(|\b(?:\d+|0x[\da-f]+|0o[0-7]+|0b[01]+)n\b/i,
  );
  const output = execFileSync(process.execPath, [
    '--input-type=module',
    '-e',
    `
    import assert from 'node:assert/strict';
    for (const name of ['BigInt', 'URL', 'URLSearchParams', 'TextEncoder', 'TextDecoder']) {
      globalThis[name] = undefined;
    }
    globalThis.self = { location: { origin: 'https://example.com', pathname: '/worker.js' } };
    assert.equal(typeof location, 'undefined');
    const { validateArguments } = await import(${JSON.stringify(schemaUrl)});
    const schema = {
      type: 'object',
      properties: { value: { $ref: '#/$defs/name' } },
      $defs: { name: { type: 'string', minLength: 1 } },
      required: ['value']
    };
    assert.deepEqual(validateArguments({ value: 'Ada' }, schema), { value: 'Ada' });
    assert.throws(() => validateArguments({ value: '' }, schema));
    const references = {
      $id: 'https://example.com/schemas/root.json?revision=1',
      type: 'object',
      $defs: {
        name: { $id: '../shared/name.json', type: 'string', minLength: 1 },
        count: { $anchor: 'count', type: 'integer', minimum: 1 },
        code: { $id: 'urn:example:code', type: 'string', pattern: '^[A-Z]+$' },
        'a/b~c': { type: 'boolean' },
      },
      properties: {
        name: { $ref: '../shared/name.json' },
        count: { $ref: '#count' },
        code: { $ref: 'urn:example:code' },
        enabled: { $ref: '#/$defs/a~1b~0c' },
      },
      required: ['name', 'count', 'code', 'enabled'],
    };
    const validReferences = { name: 'Ada', count: 2, code: 'ABC', enabled: true };
    assert.deepEqual(validateArguments(validReferences, references), validReferences);
    for (const invalid of [{ name: '' }, { count: 0 }, { code: 'abc' }, { enabled: 'true' }]) {
      assert.throws(() => validateArguments({ ...validReferences, ...invalid }, references), /Invalid function arguments/);
    }
    const recursive = {
      $id: 'https://example.com/tree.json#',
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1 },
        child: { $ref: '#' },
      },
      required: ['name'],
    };
    const tree = { name: 'root', child: { name: 'leaf' } };
    assert.deepEqual(validateArguments(tree, recursive), tree);
    assert.throws(() => validateArguments({ name: 'root', child: { name: '' } }, recursive), /Invalid function arguments/);
    for (const [value, multipleOf, valid] of [
      [0.3, 0.1, true], [-0.3, 0.1, true], [0.31, 0.1, false],
      [0.30000000000000004, 0.1, false], [-1.234, 0.001, true],
      [0, 0.3, true], [-0, 0.3, true], [1, 3, false],
      [9007199254740991, 3, false], [9007199254740990, 3, true],
      [1e308, 1e-308, true], [1e-308, 1e308, false],
      [Number.MIN_VALUE, Number.MIN_VALUE, true], [1, Number.MIN_VALUE, true],
      [1e-323, 1e-322, false], [Number.MAX_VALUE, 1e308, false]
    ]) {
      const numericSchema = {
        type: 'object', properties: { value: { type: 'number', multipleOf } }
      };
      if (valid) {
        assert.deepEqual(validateArguments({ value }, numericSchema), { value });
      } else {
        assert.throws(() => validateArguments({ value }, numericSchema), /Invalid function arguments/);
      }
    }
    assert.equal(typeof location, 'undefined');
    assert.equal(typeof BigInt, 'undefined');
    assert.equal(typeof URL, 'undefined');
    assert.equal(typeof URLSearchParams, 'undefined');
    console.log('passed');
  `,
  ], { encoding: 'utf8' });
  expect(output.trim()).toBe('passed');
});
