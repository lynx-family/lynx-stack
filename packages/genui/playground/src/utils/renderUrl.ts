// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { encodeBase64Url } from './base64url.js';
import type { Protocol } from './protocol.js';

export const RENDER_INIT_DATA_QUERY_PARAM = 'initData';
export const RENDER_METRIC_ID_QUERY_PARAM = 'previewMetricId';
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

export function hasShareableA2UIRenderPayload(
  init: Pick<RenderInit, 'demoId' | 'messages' | 'messagesUrl'>,
): boolean {
  if (init.demoId || init.messagesUrl) return true;
  return Array.isArray(init.messages)
    ? init.messages.length > 0
    : init.messages !== undefined;
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

export function buildRenderUrl(init: RenderInit, baseUrl: string): string {
  const url = new URL('render.html', baseUrl);
  url.searchParams.set('protocol', init.protocol.name);
  url.searchParams.set('demoUrl', init.demoUrl);
  if (init.theme) {
    url.searchParams.set('theme', init.theme);
  }

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

export function canInlineOpenUIRenderUrl(url: string): boolean {
  return url.length <= OPENUI_INLINE_RENDER_URL_MAX_LENGTH;
}
