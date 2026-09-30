// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { TosClient } from '@volcengine/tos-sdk';

const DEFAULT_A2UI_STORAGE_PREFIX = 'a2ui';
const DEFAULT_HTML_STORAGE_PREFIX = 'html';
const DEFAULT_LYNX_XML_STORAGE_PREFIX = 'lynx-xml';
const DEFAULT_MCP_APPS_STORAGE_PREFIX = 'mcp-apps';
const DEFAULT_OPENUI_STORAGE_PREFIX = 'openui';
const DEFAULT_REACTLYNX_STORAGE_PREFIX = 'reactlynx';

type StorageEnvironment = Readonly<Record<string, string | undefined>>;

export const TOS_STORAGE_METHODS = [
  'a2ui',
  'openui',
  'mcp-apps',
  'reactlynx',
  'lynx-xml',
  'html',
] as const;
export type TosStorageMethod = typeof TOS_STORAGE_METHODS[number];

export const TOS_STORAGE_TYPES = ['preview', 'conversation'] as const;
export type TosStorageType = typeof TOS_STORAGE_TYPES[number];

export interface TosStorageConfig {
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  endpoint: string;
  region: string;
  secure: boolean;
  securityToken?: string;
  a2uiPrefix: string;
  htmlPrefix: string;
  lynxXmlPrefix: string;
  mcpAppsPrefix: string;
  openuiPrefix: string;
  reactLynxPrefix: string;
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
    htmlPrefix: readNonEmpty(environment, 'TOS_HTML_STORAGE_PREFIX')
      ?? DEFAULT_HTML_STORAGE_PREFIX,
    lynxXmlPrefix: readNonEmpty(
      environment,
      'TOS_LYNX_XML_STORAGE_PREFIX',
    ) ?? DEFAULT_LYNX_XML_STORAGE_PREFIX,
    mcpAppsPrefix: readNonEmpty(environment, 'TOS_MCP_APPS_STORAGE_PREFIX')
      ?? DEFAULT_MCP_APPS_STORAGE_PREFIX,
    openuiPrefix: readNonEmpty(environment, 'TOS_OPENUI_STORAGE_PREFIX')
      ?? DEFAULT_OPENUI_STORAGE_PREFIX,
    reactLynxPrefix: readNonEmpty(
      environment,
      'TOS_REACTLYNX_STORAGE_PREFIX',
    ) ?? DEFAULT_REACTLYNX_STORAGE_PREFIX,
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

export function tosStoragePrefix(
  config: TosStorageConfig,
  method: TosStorageMethod,
): string {
  switch (method) {
    case 'a2ui':
      return config.a2uiPrefix;
    case 'html':
      return config.htmlPrefix;
    case 'lynx-xml':
      return config.lynxXmlPrefix;
    case 'mcp-apps':
      return config.mcpAppsPrefix;
    case 'openui':
      return config.openuiPrefix;
    case 'reactlynx':
      return config.reactLynxPrefix;
  }
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

export function createTosClient(config: TosStorageConfig): TosClient {
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

export async function uploadTosObject(
  client: TosClient,
  config: TosStorageConfig,
  path: string,
  body: string | Uint8Array,
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

export async function uploadTosJson(
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
