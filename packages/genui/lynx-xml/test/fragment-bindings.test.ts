// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { runInNewContext } from 'node:vm';

import { describe, expect, test } from '@rstest/core';

import { resolveFragmentBindings } from '../src/fragment-bindings.js';

describe('resolveFragmentBindings', () => {
  test('prepends a combined declaration while preserving directives without semicolons', () => {
    const source =
      '// leading comment\n"use custom";\n"use strict"\nfunction strict() { return this; }\nresult = strict();';
    const resolved = resolveFragmentBindings(source, {}, 'var node0, node1;');
    expect(resolved).toContain('"use strict";\nvar node0, node1;');
    const context = { result: 'pending' };
    runInNewContext(resolved, context);
    expect(context.result).toBeUndefined();
  });
  test('resolves only free references and preserves shorthand property keys', () => {
    const source = `
var node5 = { text: "Shanghai" };
var node15 = { text: "26°" };
const weather = { cityText: "cityText" };
// cityText is an XML id.
function local(cityText) { return { cityText }; }
function block() { let currentTemp = "local"; return currentTemp; }
function hoisted() { return cityText; var cityText; }
const object = { cityText, currentTemp };
const computed = { [cityText.text]: currentTemp.text };
const template = \`cityText: \${cityText.text}\`;
result = [object, computed, template, local("local"), block(), hoisted(), weather.cityText];
`;
    const resolved = resolveFragmentBindings(source, {
      cityText: 'node5',
      currentTemp: 'node15',
    });
    expect(resolved).toContain(
      'const object = { cityText: node5, currentTemp: node15 };',
    );
    expect(resolved).toContain('// cityText is an XML id.');
    expect(resolved).toContain(
      'function local(cityText) { return { cityText }; }',
    );
    const context = { result: undefined };
    runInNewContext(resolved, context);
    expect(context.result).toEqual([
      { cityText: { text: 'Shanghai' }, currentTemp: { text: '26°' } },
      { Shanghai: '26°' },
      'cityText: Shanghai',
      { cityText: 'local' },
      'local',
      undefined,
      'cityText',
    ]);
  });

  test('preserves explicit global aliases and unrelated unknown identifiers', () => {
    const source =
      `var node5; var cityText; function update() { return cityText || unknown; }`;
    expect(resolveFragmentBindings(source, { cityText: 'node5' })).toBe(source);
    expect(resolveFragmentBindings('toString();', {})).toBe('toString();');
  });

  test('handles writes and destructuring defaults without renaming keys', () => {
    const source =
      `var node5; ({ cityText = "fallback" } = {}); result = { cityText };`;
    const resolved = resolveFragmentBindings(source, { cityText: 'node5' });
    const context = { result: undefined };
    runInNewContext(resolved, context);
    expect(context.result).toEqual({ cityText: 'fallback' });
  });

  test('rejects target capture by a local node variable', () => {
    expect(() =>
      resolveFragmentBindings(
        'var node5; function update(node5) { return cityText; }',
        { cityText: 'node5' },
      )
    ).toThrow('shadowed or missing node "node5"');
  });
});
