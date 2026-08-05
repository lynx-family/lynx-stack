// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const ONLINE_A2UI_SERVER_ORIGIN = 'https://genui-server.vercel.app';
const LOCAL_A2UI_SERVER_PORT = '3060';

declare const __GENUI_PLAYGROUND_LOCAL_SERVER__: boolean;

export interface PublishedPayload {
  messagesUrl: string;
  actionMocksUrl?: string;
}

export interface PublishedOpenUIPayload {
  rawTextUrl: string;
}

export interface PublishedLynxXmlPayload {
  sourceUrl: string;
}

export function isDevHost(hostname: string): boolean {
  return (
    hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '0.0.0.0'
    || hostname === '::1'
    || hostname === '[::1]'
    || hostname.startsWith('10.')
    || hostname.startsWith('192.168.')
    || /^172\.(?:1[6-9]|2\d|3[01])\./u.test(hostname)
  );
}

export function shouldUseLocalGenUIServer(
  location: Pick<Location, 'hostname' | 'protocol'>,
): boolean {
  const isLocalDevelopmentBuild =
    typeof __GENUI_PLAYGROUND_LOCAL_SERVER__ !== 'undefined'
    && __GENUI_PLAYGROUND_LOCAL_SERVER__;
  return isLocalDevelopmentBuild
    || (location.protocol === 'http:' && isDevHost(location.hostname));
}

export function getLocalGenUIServerOrigin(hostname: string): string {
  const serverHostname = hostname === '::1' || hostname === '[::1]'
    ? '127.0.0.1'
    : hostname;
  return `http://${serverHostname}:${LOCAL_A2UI_SERVER_PORT}`;
}

export function getA2UIPayloadEndpoint(): string {
  if (shouldUseLocalGenUIServer(window.location)) {
    return `${
      getLocalGenUIServerOrigin(window.location.hostname)
    }/a2ui/payload`;
  }
  return `${ONLINE_A2UI_SERVER_ORIGIN}/a2ui/payload`;
}

export function getOpenUIPayloadEndpoint(): string {
  if (shouldUseLocalGenUIServer(window.location)) {
    return `${
      getLocalGenUIServerOrigin(window.location.hostname)
    }/openui/payload`;
  }
  return `${ONLINE_A2UI_SERVER_ORIGIN}/openui/payload`;
}

export function getLynxXmlPayloadEndpoint(): string {
  if (shouldUseLocalGenUIServer(window.location)) {
    return `${
      getLocalGenUIServerOrigin(window.location.hostname)
    }/lynx-xml/payload`;
  }
  return `${ONLINE_A2UI_SERVER_ORIGIN}/lynx-xml/payload`;
}

/**
 * Upload an A2UI payload to the GenUI server (Supabase Storage) and return the
 * durable public URLs. The returned `messagesUrl` can be fed to
 * `buildRenderUrl()` to produce a shareable `render.html` link.
 */
export async function publishA2UIPayload(
  messages: unknown,
  actionMocks?: Record<string, unknown>,
): Promise<PublishedPayload> {
  const res = await window.fetch(getA2UIPayloadEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, actionMocks }),
  });
  const payload = await res.json().catch(() => ({})) as {
    preview?: {
      messagesUrl?: unknown;
      actionMocksUrl?: unknown;
    };
    error?: unknown;
  };
  if (!res.ok || typeof payload.preview?.messagesUrl !== 'string') {
    throw new Error(
      typeof payload.error === 'string'
        ? payload.error
        : 'Failed to publish A2UI messages',
    );
  }
  return {
    messagesUrl: payload.preview.messagesUrl,
    actionMocksUrl: typeof payload.preview.actionMocksUrl === 'string'
      ? payload.preview.actionMocksUrl
      : undefined,
  };
}

/**
 * Upload OpenUI Lang source to the GenUI server and return a durable public
 * text URL. Use this instead of inlining large `rawText` query params.
 */
export async function publishOpenUIPayload(
  rawText: string,
): Promise<PublishedOpenUIPayload> {
  const res = await window.fetch(getOpenUIPayloadEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawText }),
  });
  const payload = await res.json().catch(() => ({})) as {
    preview?: {
      rawTextUrl?: unknown;
    };
    error?: unknown;
  };
  if (!res.ok || typeof payload.preview?.rawTextUrl !== 'string') {
    throw new Error(
      typeof payload.error === 'string'
        ? payload.error
        : 'Failed to publish OpenUI raw text',
    );
  }
  return {
    rawTextUrl: payload.preview.rawTextUrl,
  };
}

/** Upload a validated Lynx XML artifact and return its public source URL. */
export async function publishLynxXmlPayload(
  source: string,
): Promise<PublishedLynxXmlPayload> {
  const response = await window.fetch(getLynxXmlPayloadEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source }),
  });
  const payload = await response.json().catch(() => ({})) as {
    preview?: { sourceUrl?: unknown };
    error?: unknown;
  };
  if (!response.ok || typeof payload.preview?.sourceUrl !== 'string') {
    throw new Error(
      typeof payload.error === 'string'
        ? payload.error
        : 'Failed to publish Lynx XML source',
    );
  }
  return { sourceUrl: payload.preview.sourceUrl };
}
