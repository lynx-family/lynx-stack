// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, test } from '@rstest/core';

import { BASIC_CATALOG } from '../agent/a2ui/a2ui-catalog.js';
import { createA2UIImageSourcePolicy } from '../agent/a2ui/a2ui-image-source-policy.js';
import { buildJevCandidates } from '../agent/a2ui/jev-candidates.js';

test('prioritizes current explicit copy and complete later phrases over derived fragments', () => {
  const source = buildJevCandidates(BASIC_CATALOG, [
    'Use "Old heading".',
    `Use "New heading". ${
      Array.from({ length: 80 }, (_, index) => `word${index}`).join(' ')
    }. 最后标题。`,
  ], {});
  const choices = source.choices({ name: 'text', type: 'string' });
  expect(choices).toHaveLength(32);
  expect(choices[0]?.value).toBe('New heading');
  expect(choices.map(choice => choice.value)).toContain('最后标题');
  expect(choices.map(choice => choice.value)).toContain('Old heading');
});

test('expands the compact budget for explicit content instead of dropping requested labels', () => {
  const labels = Array.from({ length: 40 }, (_, index) => `Label ${index}`);
  const source = buildJevCandidates(BASIC_CATALOG, [
    labels.map(value => JSON.stringify(value)).join(' '),
  ], {});
  const values = source.choices({ name: 'text', type: 'string' }).map(choice =>
    choice.value
  );
  expect(values.length).toBeGreaterThan(32);
  expect(values.length).toBeLessThanOrEqual(96);
  expect(values).toEqual(expect.arrayContaining(labels));
});

test('ranks matching JSON fields and filters by property type without losing enum alternatives', () => {
  const source = buildJevCandidates(BASIC_CATALOG, [
    JSON.stringify({ width: 111, height: 222, title: 'Weather' }),
  ], {});
  const numbers = source.choices({ name: 'height', type: 'number' });
  expect(numbers[0]?.value).toBe(222);
  expect(numbers.every(choice => typeof choice.value === 'number')).toBe(true);
  const enums = Array.from({ length: 40 }, (_, index) => `style-${index}`);
  expect(
    source.choices({ name: 'variant', type: 'string', enums }).map(choice =>
      choice.value
    ),
  ).toEqual(enums);
});

test('reserves unquoted multilingual fragments even when history fills the explicit-content budget', () => {
  const source = buildJevCandidates(BASIC_CATALOG, [
    Array.from({ length: 100 }, (_, index) => `"Old label ${index}"`).join(' '),
    '做一个天气面板，标题改为上海天气。',
  ], {});
  const choices = source.choices({ name: 'text', type: 'string' });
  expect(choices.length).toBeLessThanOrEqual(96);
  expect(choices.map(choice => choice.value)).toContain('上海天气');
});

test('retains explicitly requested unquoted enum values beyond the Catalog truncation boundary', () => {
  const enums = Array.from({ length: 110 }, (_, index) => `style${index}`);
  const source = buildJevCandidates(BASIC_CATALOG, [
    'Use style109 for the appearance',
  ], {});
  const choices = source.choices({ name: 'variant', type: 'string', enums });
  expect(choices).toHaveLength(96);
  expect(choices[0]?.value).toBe('style109');
});

test('keeps matching bindings ahead of unrelated paths without exposing their values', () => {
  const data = Object.fromEntries(
    Array.from(
      { length: 100 },
      (_, index) => [`field${index}`, 'private-input-value'],
    ),
  );
  data.title = 'private-title-value';
  const source = buildJevCandidates(BASIC_CATALOG, ['Show the title'], data);
  const choices = source.choices({
    name: 'title',
    type: 'string',
    schema: {
      oneOf: [{ type: 'string' }, {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
        additionalProperties: false,
      }],
    },
  });
  expect(choices[0]?.value).toEqual({ path: '/title' });
  expect(JSON.stringify(choices)).not.toContain('private-');
});

test('distinguishes synthetic empty placeholders from explicit values and constrained Catalog choices', () => {
  const prop = {
    name: 'checks',
    type: 'array',
    schema: { type: 'array', items: { type: 'string' } },
  };
  const empty = buildJevCandidates(BASIC_CATALOG, ['Show a button'], {})
    .choices(prop);
  expect(empty).toEqual([{
    value: [],
    description: 'Catalog/default value: []',
    placeholder: true,
  }]);
  const supplied = buildJevCandidates(BASIC_CATALOG, ['{"checks":[]}'], {})
    .choices(prop);
  expect(supplied).toEqual([{ value: [], description: '[]' }]);
  const constrained = buildJevCandidates(BASIC_CATALOG, [], {}).choices({
    name: 'text',
    type: 'string',
    schema: { type: 'string', enum: [''] },
  });
  expect(constrained).toEqual([{
    value: '',
    description: 'Catalog/default value: ""',
  }]);
});

test('keeps full signed image sources while excluding descriptive copy', () => {
  const url = `https://example.com/image.png?signature=${'x'.repeat(200)}`;
  const requests = [`Use this image: ${url}\nA photo.`];
  const source = buildJevCandidates(
    BASIC_CATALOG,
    requests,
    {},
    createA2UIImageSourcePolicy(requests),
  );
  expect(
    source.choices({ name: 'url', type: 'string' }, 'Image').map(choice =>
      choice.value
    ),
  ).toEqual([url]);
  expect(
    source.choices({ name: 'url', type: 'string' }, 'Image').map(choice =>
      choice.value
    ),
  ).not.toContain('A photo');
});

test('requires supplied display content for new controls while allowing empty input state', () => {
  const source = buildJevCandidates(
    BASIC_CATALOG,
    ['Show four answer buttons'],
    {},
  );
  expect(source.specs.map(spec => spec.name)).not.toContain('RadioGroup');
  expect(source.specs.map(spec => spec.name)).toContain('TextField');
  const items = BASIC_CATALOG.components.find(spec =>
    spec.name === 'RadioGroup'
  )!
    .props.find(prop => prop.name === 'items')!;
  expect(source.choices(items, 'RadioGroup')).toEqual([]);
  const supplied = buildJevCandidates(BASIC_CATALOG, [
    JSON.stringify({ items: ['Triangle', 'Square', 'Circle', 'Hexagon'] }),
  ], {});
  expect(supplied.specs.map(spec => spec.name)).toContain('RadioGroup');
  expect(supplied.choices(items, 'RadioGroup').map(choice => choice.value))
    .toEqual([['Triangle', 'Square', 'Circle', 'Hexagon']]);
  expect(
    buildJevCandidates(BASIC_CATALOG, ['{"items":[]}'], {})
      .choices(items, 'RadioGroup').map(choice => choice.value),
  ).toEqual([[]]);
});
