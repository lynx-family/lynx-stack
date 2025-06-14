/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/

import { test, expect } from 'vitest';

import { parse } from '../src/index.js';
import { readCode } from './utils.js';
import { removeFunctionWhiteSpace } from '../src/plugins/index';

test('clip-path', () => {
  expect(
    parse(readCode('clip-path'), { plugins: [removeFunctionWhiteSpace()] })
      .root,
  ).toMatchSnapshot();
});

test('font-face', () => {
  expect(parse(readCode('font-face')).root).toMatchSnapshot();
});

test('font-face-base64', () => {
  expect(parse(readCode('font-face-base64')).root).toMatchSnapshot();
});

test('keyframes', () => {
  expect(parse(readCode('keyframes')).root).toMatchSnapshot();
});

test('import', () => {
  expect(parse(readCode('import')).root).toMatchSnapshot();
});

test('rules', () => {
  expect(parse(readCode('rules')).root).toMatchSnapshot();
});

test('attribute', () => {
  expect(parse(readCode('attribute')).root).toMatchSnapshot();
});

test('color', () => {
  expect(
    parse(readCode('color'), { plugins: [removeFunctionWhiteSpace()] }).root,
  ).toMatchSnapshot();
});

test('comment', () => {
  expect(parse(readCode('comment')).root).toMatchSnapshot();
});

test('dimension', () => {
  expect(parse(readCode('dimension')).root).toMatchSnapshot();
});

test('important', () => {
  expect(
    parse(readCode('important'), {
      filename: 'pages/view/index.css',
      projectRoot: '/user/test/project1',
    }).root,
  ).toMatchSnapshot();
});

test('break-rule', () => {
  expect(parse(readCode('break-rule')).root).toMatchSnapshot();
});

test('url-contain-identifier', () => {
  expect(parse(readCode('url-contain-identifier')).root).toMatchSnapshot();
});

test('function', () => {
  expect(parse(readCode('function')).root).toMatchSnapshot();
});

test('css-variable', () => {
  expect(parse(readCode('css-variable')).root).toMatchSnapshot();
});

test('slash-selector', () => {
  expect(parse(readCode('slash-selector')).root).toMatchSnapshot();
});

test('aspect-ratio', () => {
  expect(parse(readCode('aspect-ratio')).root).toMatchSnapshot();
});

test('no-space-within-name-value', () => {
  expect(parse(readCode('no-space-within-name-value')).root).toMatchSnapshot();
});

test('single-at-rule', () => {
  expect(parse(readCode('single-at-rule'))).toMatchSnapshot();
});

test('css-variable-with-shorthand-properties', () => {
  expect(parse(readCode('css-variable-with-shorthand-properties')))
    .toMatchSnapshot();
});

test('set-string-mark', () => {
  expect(
    parse(readCode('string-value'), {
      plugins: [],
    }),
  ).toMatchSnapshot();
});

test('backslash-escape', () => {
  expect(
    parse(readCode('backslash-escape'), {
      plugins: [],
      enableCSSSelector: true,
    }),
  ).toMatchSnapshot();

  expect(
    parse(readCode('backslash-escape'), {
      plugins: [],
      enableCSSSelector: false,
    }),
  ).toMatchSnapshot();
});
