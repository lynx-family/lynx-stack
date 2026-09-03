// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { GENUI_SERVER_URL, buildGenuiServerUrl } from './genuiServer.js';
import {
  DEFAULT_GENUI_SERVER_URL,
  assertTrustedGenuiServerCredentialTarget,
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
    expect(resolveGenuiServerUrl('http://127.0.0.1:3060')).toBe(
      'http://127.0.0.1:3060',
    );
  });

  test('requires HTTPS for non-loopback server origins', () => {
    expect(() => resolveGenuiServerUrl('http://genui.example.com'))
      .toThrow('GENUI_SERVER_URL must use HTTPS');
    expect(() => resolveGenuiServerUrl('http://192.168.1.8:3060'))
      .toThrow('GENUI_SERVER_URL must use HTTPS');
    expect(() => resolveGenuiServerUrl('http://0.0.0.0:3060'))
      .toThrow('GENUI_SERVER_URL must use HTTPS');
  });

  test('locks credential-bearing requests to the configured secure origin', () => {
    expect(() =>
      assertTrustedGenuiServerCredentialTarget(
        'https://genui.example.com/a2ui/stream',
        'https://genui.example.com',
      )
    ).not.toThrow();
    expect(() =>
      assertTrustedGenuiServerCredentialTarget(
        'https://attacker.example.com/a2ui/stream',
        'https://genui.example.com',
      )
    ).toThrow('configured GenUI Server origin');
    expect(() =>
      assertTrustedGenuiServerCredentialTarget(
        'http://genui.example.com/a2ui/stream',
        'http://genui.example.com',
      )
    ).toThrow('require an HTTPS GenUI Server');
  });

  test('rejects a configured URL with non-origin components', () => {
    expect(() => resolveGenuiServerUrl('https://genui.example.com/api'))
      .toThrow('GENUI_SERVER_URL must be an HTTP(S) origin');
    expect(() => resolveGenuiServerUrl('file:///tmp/genui'))
      .toThrow('GENUI_SERVER_URL must be an HTTP(S) origin');
  });
});
