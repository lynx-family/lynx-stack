// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { TosClient } from '@volcengine/tos-sdk';

const DEFAULT_A2UI_STORAGE_PREFIX = 'a2ui';
const DEFAULT_LYNX_XML_STORAGE_PREFIX = 'lynx-xml';
const DEFAULT_MCP_APPS_STORAGE_PREFIX = 'mcp-apps';
const DEFAULT_OPENUI_STORAGE_PREFIX = 'openui';

type StorageEnvironment = Readonly<Record<string, string | undefined>>;

export const TOS_STORAGE_METHODS = [
  'a2ui',
  'openui',
  'mcp-apps',
  'lynx-xml',
] as const;
export type TosStorageMethod = typeof TOS_STORAGE_METHODS[number];

export const TOS_STORAGE_TYPES = ['preview', 'conversation'] as const;
export type TosStorageType = typeof TOS_STORAGE_TYPES[number];

export type TosStorageLocation =
  | { method: 'a2ui' | 'openui'; type: 'preview' }
  | { method: TosStorageMethod; type: 'conversation' };

const A2UI_PREVIEW_LOCATION: TosStorageLocation = {
  method: 'a2ui',
  type: 'preview',
};

const OPENUI_PREVIEW_LOCATION: TosStorageLocation = {
  method: 'openui',
  type: 'preview',
};

export interface TosStorageConfig {
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  endpoint: string;
  region: string;
  secure: boolean;
  securityToken?: string;
  a2uiPrefix: string;
  lynxXmlPrefix: string;
  mcpAppsPrefix: string;
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
  const bucket = readNonEmpty(environment, 'TOS_BUCKET');
  const region = readNonEmpty(environment, 'TOS_REGION');
  if (!accessKeyId || !accessKeySecret || !bucket || !region) return undefined;

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
    lynxXmlPrefix: readNonEmpty(
      environment,
      'TOS_LYNX_XML_STORAGE_PREFIX',
    ) ?? DEFAULT_LYNX_XML_STORAGE_PREFIX,
    mcpAppsPrefix: readNonEmpty(environment, 'TOS_MCP_APPS_STORAGE_PREFIX')
      ?? DEFAULT_MCP_APPS_STORAGE_PREFIX,
    openuiPrefix: readNonEmpty(environment, 'TOS_OPENUI_STORAGE_PREFIX')
      ?? DEFAULT_OPENUI_STORAGE_PREFIX,
  };
}

export function buildTosStoragePath(
  method: string,
  type: TosStorageType,
  id: string,
  file: string,
): string {
  const prefix = trimSlashes(method);
  const suffix = `${type}/${id}/${file}`;
  return prefix ? `${prefix}/${suffix}` : suffix;
}

export function isTosStorageMethod(value: unknown): value is TosStorageMethod {
  return TOS_STORAGE_METHODS.some(method => method === value);
}

export function isTosStorageType(value: unknown): value is TosStorageType {
  return TOS_STORAGE_TYPES.some(type => type === value);
}

function storageMethodPrefix(
  config: TosStorageConfig,
  method: TosStorageMethod,
): string {
  switch (method) {
    case 'a2ui':
      return config.a2uiPrefix;
    case 'lynx-xml':
      return config.lynxXmlPrefix;
    case 'mcp-apps':
      return config.mcpAppsPrefix;
    case 'openui':
      return config.openuiPrefix;
  }
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
  location: TosStorageLocation = A2UI_PREVIEW_LOCATION,
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
      storageMethodPrefix(config, location.method),
      location.type,
      id,
      'messages.json',
    );
    await uploadTosJson(client, config, messagesPath, messages);
    const messagesUrl = buildTosObjectUrl(messagesPath, config);

    if (actionMocks !== undefined) {
      const actionMocksPath = buildTosStoragePath(
        storageMethodPrefix(config, location.method),
        location.type,
        id,
        'actionMocks.json',
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
      storageMethodPrefix(config, OPENUI_PREVIEW_LOCATION.method),
      OPENUI_PREVIEW_LOCATION.type,
      id,
      'raw.txt',
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
