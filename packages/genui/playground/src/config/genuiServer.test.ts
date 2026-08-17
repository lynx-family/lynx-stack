// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { GENUI_SERVER_URL, buildGenuiServerUrl } from './genuiServer.js';
import {
  DEFAULT_GENUI_SERVER_URL,
  resolveGenuiServerUrl,
} from '../../genui-server-url.js';

describe('GenUI server URL configuration', () => {
  test('defaults to localhost and builds server endpoint URLs', () => {
    expect(resolveGenuiServerUrl(undefined)).toBe(DEFAULT_GENUI_SERVER_URL);
    expect(GENUI_SERVER_URL).toBe(DEFAULT_GENUI_SERVER_URL);
    expect(buildGenuiServerUrl('/a2ui/stream')).toBe(
      'http://localhost:3060/a2ui/stream',
    );
  });

  test('normalizes a configured HTTP(S) origin', () => {
    expect(resolveGenuiServerUrl(' https://genui.example.com/ ')).toBe(
      'https://genui.example.com',
    );
  });

  test('rejects a configured URL with non-origin components', () => {
    expect(() => resolveGenuiServerUrl('https://genui.example.com/api'))
      .toThrow('GENUI_SERVER_URL must be an HTTP(S) origin');
    expect(() => resolveGenuiServerUrl('file:///tmp/genui'))
      .toThrow('GENUI_SERVER_URL must be an HTTP(S) origin');
  });
});
