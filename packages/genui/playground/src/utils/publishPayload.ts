// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const LOCAL_A2UI_SERVER_PORT = '3060';

export interface PublishedPayload {
  messagesUrl: string;
  actionMocksUrl?: string;
}

export interface PublishedOpenUIPayload {
  rawTextUrl: string;
}

export function isDevHost(hostname: string): boolean {
  return (
    hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '0.0.0.0'
    || hostname.startsWith('10.')
    || hostname.startsWith('192.168.')
    || /^172\.(?:1[6-9]|2\d|3[01])\./u.test(hostname)
  );
}

export function getA2UIPayloadEndpoint(): string {
  if (
    window.location.protocol === 'http:' && isDevHost(window.location.hostname)
  ) {
    return `http://${window.location.hostname}:${LOCAL_A2UI_SERVER_PORT}/a2ui/payload`;
  }
  return new URL('/a2ui/payload', window.location.origin).toString();
}

export function getOpenUIPayloadEndpoint(): string {
  if (
    window.location.protocol === 'http:' && isDevHost(window.location.hostname)
  ) {
    return `http://${window.location.hostname}:${LOCAL_A2UI_SERVER_PORT}/openui/payload`;
  }
  return new URL('/openui/payload', window.location.origin).toString();
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
