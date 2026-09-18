// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { readOpenUIRenderErrorEvent } from './openuiRenderErrors.js';
import { RENDER_NAVIGATION_TOKEN_QUERY_PARAM } from './renderUrl.js';
import {
  OPENUI_RENDER_ERRORS_MESSAGE_TYPE,
  formatOpenUIRenderErrors,
  readOpenUIRenderErrors,
} from '../../lynx-src/openui/renderErrors.js';

const ERROR = {
  source: 'parser',
  code: 'type-mismatch',
  message: 'Expected a boolean.',
  statementId: 'root',
  component: 'Stack',
  path: '/wrap',
  hint: 'Use true or false.',
};
const frameWindow = {};
const frameSrc =
  `https://preview.example/render.html?${RENDER_NAVIGATION_TOKEN_QUERY_PARAM}=current`;
const frames = [{ src: frameSrc, contentWindow: frameWindow }];
const event = {
  source: frameWindow,
  origin: 'https://preview.example',
  data: {
    type: OPENUI_RENDER_ERRORS_MESSAGE_TYPE,
    navigationToken: 'current',
    errors: [ERROR],
  },
};

describe('OpenUI render error feedback', () => {
  test('preserves structured diagnostics and accepts an explicit clear', () => {
    expect(readOpenUIRenderErrorEvent(event, frameSrc, frames)).toEqual([
      ERROR,
    ]);
    expect(readOpenUIRenderErrorEvent(
      {
        ...event,
        data: { ...event.data, errors: [] },
      },
      frameSrc,
      frames,
    )).toEqual([]);
    expect(formatOpenUIRenderErrors([ERROR])).toContain('root · Stack · /wrap');
    expect(formatOpenUIRenderErrors([ERROR])).toContain(ERROR.hint);
    expect(formatOpenUIRenderErrors([])).toBe('');
  });

  test.each([
    { ...event, source: {} },
    { ...event, source: null },
    { ...event, origin: 'https://other.example' },
    { ...event, data: { ...event.data, navigationToken: 'previous' } },
    { ...event, data: { type: 'OTHER_EVENT', errors: [ERROR] } },
  ])('rejects a message from another source or navigation: %#', (message) => {
    expect(readOpenUIRenderErrorEvent(message, frameSrc, frames)).toBeNull();
  });

  test('rejects missing or replaced preview frames', () => {
    expect(readOpenUIRenderErrorEvent(event, frameSrc, [])).toBeNull();
    expect(readOpenUIRenderErrorEvent(event, frameSrc, [{
      src: `${frameSrc}-replaced`,
      contentWindow: frameWindow,
    }])).toBeNull();
    expect(readOpenUIRenderErrorEvent(event, '', frames)).toBeNull();
    expect(readOpenUIRenderErrorEvent(
      event,
      'https://preview.example/render.html',
      frames,
    )).toBeNull();
  });

  test.each([
    null,
    {},
    { errors: 'error' },
    { errors: [null] },
    { errors: [{ ...ERROR, code: 12 }] },
    { errors: [{ ...ERROR, message: '' }] },
    { errors: [{ ...ERROR, path: {} }] },
  ])('rejects malformed bridge payloads: %#', (payload) => {
    expect(readOpenUIRenderErrors(payload)).toBeNull();
  });

  test('preserves future upstream codes and query tool context', () => {
    const error = {
      source: 'query',
      code: 'future-tool-error',
      message: 'Query failed.',
      toolName: 'get_weather',
    };
    expect(readOpenUIRenderErrors({ errors: [error] })).toEqual([error]);
  });
});
