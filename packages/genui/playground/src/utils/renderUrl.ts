// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { encodeBase64Url } from './base64url.js';
import type { Protocol } from './protocol.js';

export const RENDER_INIT_DATA_QUERY_PARAM = 'initData';
export {
  LYNX_XML_RENDER_READY_MESSAGE_TYPE,
  RENDER_METRIC_ID_QUERY_PARAM,
  RENDER_NAVIGATION_TOKEN_QUERY_PARAM,
} from './previewFrameProtocol.js';
export const LYNX_XML_SOURCE_URL_QUERY_PARAM = 'sourceUrl';
export const A2UI_INLINE_RENDER_URL_MAX_LENGTH = 7_000;
export const OPENUI_INLINE_RENDER_URL_MAX_LENGTH = 7_000;

export interface RenderInit {
  protocol: Protocol;
  demoUrl: string;
  messagesUrl?: string;
  messages: unknown;
  actionMocksUrl?: string;
  actionMocks?: unknown;
  /** Theme forwarded to the preview runtime. */
  theme?: 'light' | 'dark';
  /** When set, use a short `?demo=<id>` param instead of inlining the payload. */
  demoId?: string;
  /** Simulation speed multiplier (e.g. 0, 0.5, 1, 2, 4); 0 disables delay. */
  speed?: number;
  /** When true, render the final UI immediately without streaming playback. */
  instant?: boolean;
  /** When true, actions in the preview are forwarded to the parent frame for live agent handling. */
  liveAction?: boolean;
  /**
   * When true, the preview waits for `A2UI_PLAYBACK_PROGRESS` events from the
   * parent frame to advance the delivered chunk count instead of streaming on
   * its own pace.
   */
  playbackMode?: boolean;
}

export interface OpenUIRenderInit {
  rawText?: string;
  rawTextUrl?: string;
  /** Theme forwarded to the OpenUI preview runtime. */
  theme?: 'light' | 'dark';
  speed?: number;
  instant?: boolean;
  /** When true, actions are forwarded to the parent frame for live agent handling. */
  liveAction?: boolean;
  playbackMode?: boolean;
}

export interface McpAppsRenderInit {
  mcpAppData: unknown;
  theme?: 'light' | 'dark';
}

export interface LynxXmlRenderInit {
  sourceUrl: string;
  theme?: 'light' | 'dark';
}

export function hasShareableA2UIRenderPayload(
  init: Pick<RenderInit, 'demoId' | 'messages' | 'messagesUrl'>,
): boolean {
  if (init.demoId || init.messagesUrl) return true;
  return Array.isArray(init.messages)
    ? init.messages.length > 0
    : init.messages !== undefined;
}

export function hasExternalA2UIRenderPayload(
  init: Pick<RenderInit, 'demoId' | 'messagesUrl'>,
): boolean {
  if (typeof init.demoId === 'string' && init.demoId.trim().length > 0) {
    return true;
  }
  return isPortableA2UIMessagesUrl(init.messagesUrl);
}

export function isPortableA2UIMessagesUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim().length === 0) return false;
  try {
    const protocol = new URL(
      value,
      'https://a2ui-payload.invalid/',
    ).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

interface ObjectURLRegistry {
  // eslint-disable-next-line n/no-unsupported-features/node-builtins
  createObjectURL(object: Blob): string;
  revokeObjectURL(url: string): void;
}

interface LocalBlobPayload {
  url: string;
  dispose: () => void;
}

function createLocalBlobPayload(
  content: BlobPart,
  type: string,
  registry: ObjectURLRegistry,
): LocalBlobPayload {
  // eslint-disable-next-line n/no-unsupported-features/node-builtins
  const url = registry.createObjectURL(new Blob([content], { type }));
  let disposed = false;
  return {
    url,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      registry.revokeObjectURL(url);
    },
  };
}

export interface LocalLynxXmlSourcePayload {
  sourceUrl: string;
  dispose: () => void;
}

export function createLocalLynxXmlSourcePayload(
  source: string,
  registry: ObjectURLRegistry = URL,
): LocalLynxXmlSourcePayload {
  const { url: sourceUrl, dispose } = createLocalBlobPayload(
    source,
    'application/xml;charset=utf-8',
    registry,
  );
  return { sourceUrl, dispose };
}

export interface LocalA2UIMessagesPayload {
  messagesUrl: string;
  dispose: () => void;
}

export const LOCAL_A2UI_MESSAGES_PAYLOAD_RELEASE_TIMEOUT_MS = 30_000;

export interface LocalA2UIMessagesPayloadCache {
  ensure: (messages: unknown) => LocalA2UIMessagesPayload;
  markLoaded: (messagesUrl: string) => void;
  clear: () => void;
  dispose: () => void;
}

interface LocalA2UIMessagesPayloadCacheOptions {
  createPayload: (messages: unknown) => LocalA2UIMessagesPayload;
  releaseTimeoutMs?: number;
  scheduleRelease?: (callback: () => void, delayMs: number) => unknown;
  cancelRelease?: (handle: unknown) => void;
}

interface LocalA2UIMessagesPayloadCacheEntry {
  messages: unknown;
  payload: LocalA2UIMessagesPayload;
  releaseHandle?: unknown;
  releaseScheduled: boolean;
}

export function createLocalA2UIMessagesPayload(
  messages: unknown,
  registry: ObjectURLRegistry = URL,
): LocalA2UIMessagesPayload {
  const serialized = JSON.stringify(messages);
  if (serialized === undefined) {
    throw new Error('A2UI messages must be JSON serializable');
  }
  const { url: messagesUrl, dispose } = createLocalBlobPayload(
    serialized,
    'application/json',
    registry,
  );
  return { messagesUrl, dispose };
}

/**
 * Reuse the current Blob while its messages stay unchanged. Replaced payloads
 * remain alive until the successor runtime confirms loading, with a bounded
 * fallback for frames that disappear before they can report readiness.
 */
export function createLocalA2UIMessagesPayloadCache(
  options: LocalA2UIMessagesPayloadCacheOptions,
): LocalA2UIMessagesPayloadCache {
  const releaseTimeoutMs = options.releaseTimeoutMs
    ?? LOCAL_A2UI_MESSAGES_PAYLOAD_RELEASE_TIMEOUT_MS;
  const scheduleRelease = options.scheduleRelease
    ?? ((callback: () => void, delayMs: number) =>
      setTimeout(callback, delayMs));
  const cancelRelease = options.cancelRelease
    ?? ((handle: unknown) =>
      clearTimeout(handle as ReturnType<typeof setTimeout>));
  const entries = new Map<string, LocalA2UIMessagesPayloadCacheEntry>();
  let current: LocalA2UIMessagesPayloadCacheEntry | null = null;

  const disposeEntry = (entry: LocalA2UIMessagesPayloadCacheEntry) => {
    if (entries.get(entry.payload.messagesUrl) !== entry) return;
    entries.delete(entry.payload.messagesUrl);
    if (entry.releaseScheduled) cancelRelease(entry.releaseHandle);
    entry.releaseScheduled = false;
    entry.payload.dispose();
  };

  const retireCurrent = () => {
    const entry = current;
    current = null;
    if (!entry || entry.releaseScheduled) return;
    entry.releaseScheduled = true;
    entry.releaseHandle = scheduleRelease(
      () => disposeEntry(entry),
      releaseTimeoutMs,
    );
  };

  return {
    ensure: (messages) => {
      if (current && Object.is(current.messages, messages)) {
        return current.payload;
      }
      retireCurrent();

      const payload = options.createPayload(messages);
      current = {
        messages,
        payload,
        releaseScheduled: false,
      };
      entries.set(payload.messagesUrl, current);
      return payload;
    },
    markLoaded: (messagesUrl) => {
      if (current?.payload.messagesUrl !== messagesUrl) return;
      for (const entry of [...entries.values()]) {
        if (entry !== current) disposeEntry(entry);
      }
    },
    clear: retireCurrent,
    dispose: () => {
      current = null;
      for (const entry of [...entries.values()]) disposeEntry(entry);
    },
  };
}

function buildRenderInitData(init: RenderInit): Record<string, unknown> {
  const initData: Record<string, unknown> = {
    protocol: init.protocol.name,
    demoUrl: init.demoUrl,
  };

  if (init.messagesUrl) {
    initData.messagesUrl = init.messagesUrl;
  } else if (!init.demoId) {
    initData.messages = init.messages;
  }

  if (init.actionMocksUrl) {
    initData.actionMocksUrl = init.actionMocksUrl;
  } else if (init.actionMocks !== undefined) {
    initData.actionMocks = init.actionMocks;
  }

  if (init.theme) initData.theme = init.theme;
  if (init.speed !== undefined && init.speed !== 1) initData.speed = init.speed;
  if (init.instant) initData.instant = true;
  if (init.liveAction) initData.liveAction = true;
  if (init.playbackMode) initData.playbackMode = true;

  return initData;
}

type A2UIRenderBaseInit = Pick<
  RenderInit,
  | 'demoUrl'
  | 'instant'
  | 'liveAction'
  | 'playbackMode'
  | 'protocol'
  | 'speed'
  | 'theme'
>;

function buildA2UIRenderBaseUrl(
  init: A2UIRenderBaseInit,
  baseUrl: string,
): URL {
  const url = new URL('render.html', baseUrl);
  url.searchParams.set('protocol', init.protocol.name);
  url.searchParams.set('demoUrl', init.demoUrl);
  if (init.theme) {
    url.searchParams.set('theme', init.theme);
  }

  if (init.speed !== undefined && init.speed !== 1) {
    url.searchParams.set('speed', String(init.speed));
  }

  if (init.instant) {
    url.searchParams.set('instant', '1');
  }

  if (init.liveAction) {
    url.searchParams.set('liveAction', '1');
  }

  if (init.playbackMode) {
    url.searchParams.set('playbackMode', '1');
  }

  return url;
}

export function buildRenderUrl(init: RenderInit, baseUrl: string): string {
  const url = buildA2UIRenderBaseUrl(init, baseUrl);

  if (init.demoId) {
    // Known demo: reference static JSON file by ID instead of inlining payload.
    url.searchParams.set('demo', init.demoId);
  } else if (init.messagesUrl) {
    url.searchParams.set(
      RENDER_INIT_DATA_QUERY_PARAM,
      encodeBase64Url(JSON.stringify(buildRenderInitData(init))),
    );
    url.searchParams.set('messagesUrl', init.messagesUrl);
    if (init.actionMocksUrl) {
      url.searchParams.set('actionMocksUrl', init.actionMocksUrl);
    } else if (init.actionMocks !== undefined) {
      url.searchParams.set(
        'actionMocks',
        encodeBase64Url(JSON.stringify(init.actionMocks)),
      );
    }
  } else {
    // Custom JSON: inline the payload as base64url.
    url.searchParams.set(
      'messages',
      encodeBase64Url(JSON.stringify(init.messages)),
    );

    if (init.actionMocks !== undefined) {
      url.searchParams.set(
        'actionMocks',
        encodeBase64Url(JSON.stringify(init.actionMocks)),
      );
    }
  }

  return url.toString();
}

export function buildOpenUIRenderUrl(
  init: OpenUIRenderInit,
  baseUrl: string,
): string {
  const url = new URL('render.html', baseUrl);
  url.searchParams.set('protocol', 'openui');
  url.searchParams.set('demoUrl', './openui.web.js');

  if (init.theme) {
    url.searchParams.set('theme', init.theme);
  }

  if (init.rawTextUrl) {
    url.searchParams.set('rawTextUrl', init.rawTextUrl);
  } else if (init.rawText !== undefined) {
    url.searchParams.set('rawText', init.rawText);
  }

  if (init.speed !== undefined && init.speed !== 1) {
    url.searchParams.set('speed', String(init.speed));
  }

  if (init.instant) {
    url.searchParams.set('instant', '1');
  }

  if (init.liveAction) {
    url.searchParams.set('liveAction', '1');
  }

  if (init.playbackMode) {
    url.searchParams.set('playbackMode', '1');
  }

  return url.toString();
}

export function buildMcpAppsRenderUrl(
  init: McpAppsRenderInit,
  baseUrl: string,
): string {
  const url = new URL('render.html', baseUrl);
  url.searchParams.set('protocol', 'mcp-apps');
  url.searchParams.set('demoUrl', './mcp-apps.web.js');
  url.searchParams.set(
    RENDER_INIT_DATA_QUERY_PARAM,
    encodeBase64Url(JSON.stringify({
      protocol: 'mcp-apps',
      demoUrl: './mcp-apps.web.js',
      mcpAppData: init.mcpAppData,
      ...(init.theme ? { theme: init.theme } : {}),
    })),
  );
  if (init.theme) url.searchParams.set('theme', init.theme);
  return url.toString();
}

export function buildLynxXmlRenderUrl(
  init: LynxXmlRenderInit,
  baseUrl: string,
): string {
  const url = new URL('render.html', baseUrl);
  url.searchParams.set('protocol', 'lynx-xml');
  url.searchParams.set(LYNX_XML_SOURCE_URL_QUERY_PARAM, init.sourceUrl);
  if (init.theme) url.searchParams.set('theme', init.theme);
  return url.toString();
}

export function canInlineOpenUIRenderUrl(url: string): boolean {
  return url.length <= OPENUI_INLINE_RENDER_URL_MAX_LENGTH;
}

export function canInlineA2UIRenderUrl(url: string): boolean {
  return url.length <= A2UI_INLINE_RENDER_URL_MAX_LENGTH;
}
