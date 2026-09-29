// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, describe, expect, rstest, test } from '@rstest/core';

import {
  buildTosObjectUrl,
  buildTosStoragePath,
  publishLynxXmlArtifact,
  resolveTosStorageConfig,
} from '../app/a2ui/payload-publisher.js';

const { putObject } = rstest.hoisted(() => ({
  putObject: rstest.fn(),
}));

rstest.mock('@volcengine/tos-sdk', () => ({
  TosClient: class {
    putObject = putObject;
  },
}));

afterEach(() => {
  putObject.mockReset();
  rstest.restoreAllMocks();
  rstest.unstubAllEnvs();
});

describe('Volcengine TOS payload publishing', () => {
  test('requires server-side credentials, bucket and region', () => {
    expect(resolveTosStorageConfig({})).toBeUndefined();
    expect(resolveTosStorageConfig({
      TOS_ACCESS_KEY: 'ak',
    })).toBeUndefined();
    expect(resolveTosStorageConfig({
      TOS_ACCESS_KEY: 'ak',
      TOS_SECRET_KEY: 'sk',
    })).toBeUndefined();
    expect(resolveTosStorageConfig({
      TOS_ACCESS_KEY: 'ak',
      TOS_BUCKET: 'genui',
      TOS_SECRET_KEY: 'sk',
    })).toBeUndefined();
  });

  test('derives the standard endpoint from the configured region', () => {
    const config = resolveTosStorageConfig({
      TOS_ACCESS_KEY: 'ak',
      TOS_BUCKET: 'genui',
      TOS_REGION: 'cn-beijing',
      TOS_SECRET_KEY: 'sk',
    });

    expect(config).toEqual({
      accessKeyId: 'ak',
      accessKeySecret: 'sk',
      a2uiPrefix: 'a2ui',
      bucket: 'genui',
      endpoint: 'tos-cn-beijing.volces.com',
      htmlPrefix: 'html',
      lynxXmlPrefix: 'lynx-xml',
      mcpAppsPrefix: 'mcp-apps',
      openuiPrefix: 'openui',
      region: 'cn-beijing',
      secure: true,
      securityToken: undefined,
    });
    expect(config).toBeDefined();
    if (!config) return;
    expect(
      buildTosObjectUrl('a2ui/preview/id/messages.json', config),
    ).toBe(
      'https://genui.tos-cn-beijing.volces.com/a2ui/preview/id/messages.json',
    );
  });

  test('honors custom bucket, endpoint, region, prefixes and STS token', () => {
    const config = resolveTosStorageConfig({
      TOS_ACCESS_KEY: ' ak ',
      TOS_BUCKET: 'preview-bucket',
      TOS_ENDPOINT: 'http://tos-ap-southeast-1.volces.com:8080',
      TOS_HTML_STORAGE_PREFIX: '/custom-html/',
      TOS_MCP_APPS_STORAGE_PREFIX: '/custom-mcp-apps/',
      TOS_LYNX_XML_STORAGE_PREFIX: '/custom-lynx-xml/',
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
      htmlPrefix: '/custom-html/',
      lynxXmlPrefix: '/custom-lynx-xml/',
      mcpAppsPrefix: '/custom-mcp-apps/',
      region: 'ap-southeast-1',
      secure: false,
      securityToken: 'token',
    });
    expect(config).toBeDefined();
    if (!config) return;
    expect(
      buildTosStoragePath(
        config.a2uiPrefix,
        'preview',
        'id',
        'messages.json',
      ),
    ).toBe('custom-a2ui/preview/id/messages.json');
    expect(
      buildTosObjectUrl(
        'a2ui/preview/id with spaces/messages.json',
        config,
      ),
    )
      .toBe(
        'http://preview-bucket.tos-ap-southeast-1.volces.com:8080/a2ui/preview/id%20with%20spaces/messages.json',
      );
  });

  test('separates storage method and payload type in object keys', () => {
    expect(buildTosStoragePath('a2ui', 'preview', 'id', 'messages.json'))
      .toBe('a2ui/preview/id/messages.json');
    expect(buildTosStoragePath('openui', 'preview', 'id', 'raw.txt'))
      .toBe('openui/preview/id/raw.txt');
    expect(buildTosStoragePath('lynx-xml', 'preview', 'id', 'index.lynxml'))
      .toBe('lynx-xml/preview/id/index.lynxml');

    for (
      const method of ['a2ui', 'openui', 'mcp-apps', 'lynx-xml', 'html']
    ) {
      expect(
        buildTosStoragePath(method, 'conversation', 'id', 'messages.json'),
      ).toBe(`${method}/conversation/id/messages.json`);
    }
  });

  test('publishes Lynx XML as a directly loadable preview artifact', async () => {
    rstest.stubEnv('TOS_ACCESS_KEY', 'ak');
    rstest.stubEnv('TOS_SECRET_KEY', 'sk');
    rstest.stubEnv('TOS_BUCKET', 'genui');
    rstest.stubEnv('TOS_REGION', 'cn-beijing');
    rstest.spyOn(crypto, 'randomUUID').mockReturnValue(
      '00000000-0000-4000-8000-000000000000',
    );
    const source = '<!doctype lynx><lynx engine-version="4.2"></lynx>';

    await expect(publishLynxXmlArtifact(source)).resolves.toEqual({
      sourceUrl:
        'https://genui.tos-cn-beijing.volces.com/lynx-xml/preview/00000000-0000-4000-8000-000000000000/index.lynxml',
    });
    expect(putObject).toHaveBeenCalledTimes(1);
    expect(putObject).toHaveBeenCalledWith(expect.objectContaining({
      body: Buffer.from(source),
      bucket: 'genui',
      cacheControl: 'public, max-age=1800',
      contentType: 'application/xml; charset=utf-8',
      key: 'lynx-xml/preview/00000000-0000-4000-8000-000000000000/index.lynxml',
    }));
  });
});
