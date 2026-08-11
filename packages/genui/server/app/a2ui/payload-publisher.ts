// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { TosClient } from '@volcengine/tos-sdk';

const DEFAULT_TOS_BUCKET = 'genui';
const DEFAULT_TOS_REGION = 'cn-beijing';
const DEFAULT_A2UI_STORAGE_PREFIX = 'a2ui';
const DEFAULT_OPENUI_STORAGE_PREFIX = 'openui';

type StorageEnvironment = Readonly<Record<string, string | undefined>>;

export interface TosStorageConfig {
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  endpoint: string;
  region: string;
  secure: boolean;
  securityToken?: string;
  a2uiPrefix: string;
  openuiPrefix: string;
}

export interface A2UIPublishedPayload {
  messagesUrl: string;
  actionMocksUrl?: string;
}

export interface OpenUIPublishedPayload {
  rawTextUrl: string;
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

function readNonEmpty(
  environment: StorageEnvironment,
  name: string,
): string | undefined {
  const value = environment[name]?.trim();
  if (!value) return undefined;
  return value;
}

export function resolveTosStorageConfig(
  environment: StorageEnvironment = process.env,
): TosStorageConfig | undefined {
  const accessKeyId = readNonEmpty(environment, 'TOS_ACCESS_KEY');
  const accessKeySecret = readNonEmpty(environment, 'TOS_SECRET_KEY');
  if (!accessKeyId || !accessKeySecret) return undefined;

  const bucket = readNonEmpty(environment, 'TOS_BUCKET') ?? DEFAULT_TOS_BUCKET;
  const region = readNonEmpty(environment, 'TOS_REGION') ?? DEFAULT_TOS_REGION;
  const endpointUrl = parseTosEndpoint(
    readNonEmpty(environment, 'TOS_ENDPOINT')
      ?? `tos-${region}.volces.com`,
  );

  return {
    accessKeyId,
    accessKeySecret,
    bucket,
    endpoint: endpointUrl.host,
    region,
    secure: endpointUrl.protocol === 'https:',
    securityToken: readNonEmpty(environment, 'TOS_SECURITY_TOKEN'),
    a2uiPrefix: readNonEmpty(environment, 'TOS_STORAGE_PREFIX')
      ?? DEFAULT_A2UI_STORAGE_PREFIX,
    openuiPrefix: readNonEmpty(environment, 'TOS_OPENUI_STORAGE_PREFIX')
      ?? DEFAULT_OPENUI_STORAGE_PREFIX,
  };
}

export function buildTosStoragePath(
  id: string,
  file: string,
  storagePrefix: string,
): string {
  const prefix = trimSlashes(storagePrefix);
  return prefix ? `${prefix}/${id}/${file}` : `${id}/${file}`;
}

function parseTosEndpoint(endpoint: string): URL {
  const parsed = new URL(
    /^[a-z][a-z\d+.-]*:\/\//iu.test(endpoint)
      ? endpoint
      : `https://${endpoint}`,
  );
  if (
    (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    || parsed.username
    || parsed.password
    || parsed.pathname !== '/'
    || parsed.search
    || parsed.hash
  ) {
    throw new Error('TOS_ENDPOINT must be an HTTP(S) endpoint host');
  }
  return parsed;
}

export function buildTosObjectUrl(
  path: string,
  config: Pick<TosStorageConfig, 'bucket' | 'endpoint' | 'secure'>,
): string {
  const endpoint = new URL(
    `${config.secure ? 'https' : 'http'}://${config.endpoint}`,
  );
  endpoint.hostname = `${config.bucket}.${endpoint.hostname}`;
  endpoint.pathname = path
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
  endpoint.search = '';
  endpoint.hash = '';
  return endpoint.toString();
}

function createTosClient(config: TosStorageConfig): TosClient {
  return new TosClient({
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    endpoint: config.endpoint,
    region: config.region,
    secure: config.secure,
    ...(config.securityToken
      ? { stsToken: config.securityToken }
      : undefined),
  });
}

async function uploadTosObject(
  client: TosClient,
  config: TosStorageConfig,
  path: string,
  body: string,
  contentType: string,
): Promise<void> {
  await client.putObject({
    bucket: config.bucket,
    key: path,
    body: Buffer.from(body),
    contentType,
    cacheControl: 'public, max-age=1800',
  });
}

async function uploadTosJson(
  client: TosClient,
  config: TosStorageConfig,
  path: string,
  payload: unknown,
): Promise<void> {
  await uploadTosObject(
    client,
    config,
    path,
    JSON.stringify(payload),
    'application/json; charset=utf-8',
  );
}

export async function publishA2UIPayload(
  messages: unknown,
  actionMocks?: unknown,
): Promise<A2UIPublishedPayload | undefined> {
  if (messages === undefined) return undefined;

  try {
    const config = resolveTosStorageConfig();
    if (!config) {
      console.warn(
        '[a2ui:payload-publisher] Volcengine TOS is not configured',
      );
      return undefined;
    }
    const client = createTosClient(config);
    const id = crypto.randomUUID();
    const messagesPath = buildTosStoragePath(
      id,
      'messages.json',
      config.a2uiPrefix,
    );
    await uploadTosJson(client, config, messagesPath, messages);
    const messagesUrl = buildTosObjectUrl(messagesPath, config);

    if (actionMocks !== undefined) {
      const actionMocksPath = buildTosStoragePath(
        id,
        'actionMocks.json',
        config.a2uiPrefix,
      );
      await uploadTosJson(client, config, actionMocksPath, actionMocks);
      const actionMocksUrl = buildTosObjectUrl(actionMocksPath, config);
      return { messagesUrl, actionMocksUrl };
    }

    return { messagesUrl };
  } catch (err) {
    console.warn(
      '[a2ui:payload-publisher] Volcengine TOS upload failed',
      err,
    );
    return undefined;
  }
}

export async function publishOpenUIRawText(
  rawText: string,
): Promise<OpenUIPublishedPayload | undefined> {
  try {
    const config = resolveTosStorageConfig();
    if (!config) {
      console.warn(
        '[openui:payload-publisher] Volcengine TOS is not configured',
      );
      return undefined;
    }
    const client = createTosClient(config);
    const id = crypto.randomUUID();
    const rawTextPath = buildTosStoragePath(
      id,
      'raw.txt',
      config.openuiPrefix,
    );
    await uploadTosObject(
      client,
      config,
      rawTextPath,
      rawText,
      'text/plain; charset=utf-8',
    );
    const rawTextUrl = buildTosObjectUrl(rawTextPath, config);
    return { rawTextUrl };
  } catch (err) {
    console.warn(
      '[openui:payload-publisher] Volcengine TOS upload failed',
      err,
    );
    return undefined;
  }
}
