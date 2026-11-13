// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { execFileSync } from 'node:child_process';

import { expect, test } from '@rstest/core';

test('built schema validation works without a global location in a worker', () => {
  const schemaUrl = new URL('../dist/store/schema.js', import.meta.url).href;
  const output = execFileSync(process.execPath, [
    '--input-type=module',
    '-e',
    `
    import assert from 'node:assert/strict';
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
    assert.equal(typeof location, 'undefined');
    console.log('passed');
  `,
  ], { encoding: 'utf8' });
  expect(output.trim()).toBe('passed');
});
