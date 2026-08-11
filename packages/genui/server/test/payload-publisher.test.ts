// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import {
  buildTosObjectUrl,
  buildTosStoragePath,
  resolveTosStorageConfig,
} from '../app/a2ui/payload-publisher.js';

describe('Volcengine TOS payload publishing', () => {
  test('requires server-side write credentials', () => {
    expect(resolveTosStorageConfig({})).toBeUndefined();
    expect(resolveTosStorageConfig({
      TOS_ACCESS_KEY: 'ak',
    })).toBeUndefined();
  });

  test('uses the standard public-read bucket URL defaults', () => {
    const config = resolveTosStorageConfig({
      TOS_ACCESS_KEY: 'ak',
      TOS_SECRET_KEY: 'sk',
    });

    expect(config).toEqual({
      accessKeyId: 'ak',
      accessKeySecret: 'sk',
      a2uiPrefix: 'a2ui',
      bucket: 'genui',
      endpoint: 'tos-cn-beijing.volces.com',
      openuiPrefix: 'openui',
      region: 'cn-beijing',
      secure: true,
      securityToken: undefined,
    });
    expect(config).toBeDefined();
    if (!config) return;
    expect(
      buildTosObjectUrl('a2ui/id/messages.json', config),
    ).toBe(
      'https://genui.tos-cn-beijing.volces.com/a2ui/id/messages.json',
    );
  });

  test('honors custom bucket, endpoint, region, prefixes and STS token', () => {
    const config = resolveTosStorageConfig({
      TOS_ACCESS_KEY: ' ak ',
      TOS_BUCKET: 'preview-bucket',
      TOS_ENDPOINT: 'http://tos-ap-southeast-1.volces.com:8080',
      TOS_OPENUI_STORAGE_PREFIX: '/custom-openui/',
      TOS_REGION: 'ap-southeast-1',
      TOS_SECRET_KEY: ' sk ',
      TOS_SECURITY_TOKEN: 'token',
      TOS_STORAGE_PREFIX: '/custom-a2ui/',
    });

    expect(config).toMatchObject({
      accessKeyId: 'ak',
      accessKeySecret: 'sk',
      bucket: 'preview-bucket',
      endpoint: 'tos-ap-southeast-1.volces.com:8080',
      region: 'ap-southeast-1',
      secure: false,
      securityToken: 'token',
    });
    expect(config).toBeDefined();
    if (!config) return;
    expect(buildTosStoragePath('id', 'messages.json', config.a2uiPrefix))
      .toBe('custom-a2ui/id/messages.json');
    expect(buildTosObjectUrl('a2ui/id with spaces/messages.json', config))
      .toBe(
        'http://preview-bucket.tos-ap-southeast-1.volces.com:8080/a2ui/id%20with%20spaces/messages.json',
      );
  });
});
