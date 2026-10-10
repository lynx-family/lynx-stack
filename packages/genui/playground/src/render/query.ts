// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { decodeBase64Url } from '../utils/base64url.js';
import { RENDER_INIT_DATA_QUERY_PARAM } from '../utils/renderUrl.js';

export interface InitData {
  protocol?: '0.9' | 'a2ui' | 'openui' | 'mcp-apps';
  messagesUrl?: string;
  messages?: unknown;
  actionMocksUrl?: string;
  actionMocks?: unknown;
  demoUrl?: string;
  speed?: number;
  instant?: boolean;
  playbackMode?: boolean;
  theme?: 'light' | 'dark';
  rawText?: string;
  rawTextUrl?: string;
  playbackPaused?: boolean;
  liveAction?: boolean;
  liveStream?: boolean;
  mcpAppData?: unknown;
}

function parseJsonParam(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // Back-compat: accept base64url payloads to keep URLs/QR codes shorter.
    try {
      return JSON.parse(decodeBase64Url(raw)) as unknown;
    } catch {
      return undefined;
    }
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function readProtocol(value: unknown): InitData['protocol'] {
  return value === '0.9'
      || value === 'a2ui'
      || value === 'openui'
      || value === 'mcp-apps'
    ? value
    : undefined;
}

export function readRenderProtocol(
  value: unknown,
): InitData['protocol'] | 'lynx-xml' | 'reactlynx' | 'reactweb' {
  return value === 'lynx-xml' || value === 'reactlynx' || value === 'reactweb'
    ? value
    : readProtocol(value);
}

export function readTheme(value: unknown): InitData['theme'] {
  return value === 'dark' ? 'dark' : (value === 'light' ? 'light' : undefined);
}

function readSpeed(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return value;
}

function readInitDataParam(raw: string | null): InitData | null {
  if (!raw) return null;
  const parsed = parseJsonParam(raw);
  if (!parsed || typeof parsed !== 'object') return null;
  const record = parsed as Record<string, unknown>;
  const initData: InitData = {};
  initData.protocol = readProtocol(record.protocol);
  initData.messagesUrl = readString(record.messagesUrl);
  if ('messages' in record) initData.messages = record.messages;
  initData.actionMocksUrl = readString(record.actionMocksUrl);
  if ('actionMocks' in record) initData.actionMocks = record.actionMocks;
  initData.demoUrl = readString(record.demoUrl);
  initData.speed = readSpeed(record.speed);
  initData.instant = readBoolean(record.instant);
  initData.playbackMode = readBoolean(record.playbackMode);
  initData.theme = readTheme(record.theme);
  initData.rawText = readString(record.rawText);
  initData.rawTextUrl = readString(record.rawTextUrl);
  initData.playbackPaused = readBoolean(record.playbackPaused);
  initData.liveAction = readBoolean(record.liveAction);
  initData.liveStream = readBoolean(record.liveStream);
  if ('mcpAppData' in record) initData.mcpAppData = record.mcpAppData;
  return initData;
}

export function parseInitDataFromQuery(): InitData | null {
  const params = new URLSearchParams(window.location.search);
  const baseInitData = readInitDataParam(
    params.get(RENDER_INIT_DATA_QUERY_PARAM),
  );
  const protocol = params.get('protocol');
  const messagesUrl = params.get('messagesUrl');
  const demoUrl = params.get('demoUrl');
  const messages = params.get('messages');
  const actionMocks = params.get('actionMocks');
  const actionMocksUrl = params.get('actionMocksUrl');
  const demo = params.get('demo');
  const instant = params.get('instant');
  const playbackMode = params.get('playbackMode');
  const theme = params.get('theme');
  const rawText = params.get('rawText');
  const rawTextUrl = params.get('rawTextUrl');
  const mcpAppData = params.get('mcpAppData');

  if (
    !baseInitData && !protocol && !messagesUrl && !messages && !demoUrl
    && !demo && !rawText && !rawTextUrl && !mcpAppData
  ) {
    return null;
  }
  const protocolValue = readProtocol(protocol);
  const speedRaw = params.get('speed');
  const speedVal = speedRaw === null ? undefined : Number(speedRaw);
  const initData: InitData = {
    ...baseInitData,
    protocol: protocolValue ?? baseInitData?.protocol,
    messagesUrl: messagesUrl ?? baseInitData?.messagesUrl,
    actionMocksUrl: actionMocksUrl ?? baseInitData?.actionMocksUrl,
    demoUrl: demoUrl ?? baseInitData?.demoUrl,
    messages: baseInitData?.messages ?? [],
    speed: speedVal !== undefined && Number.isFinite(speedVal) && speedVal >= 0
      ? speedVal
      : baseInitData?.speed,
    instant: instant === '1' ? true : baseInitData?.instant,
    playbackMode: playbackMode === '1' ? true : baseInitData?.playbackMode,
    theme: readTheme(theme) ?? baseInitData?.theme,
    rawText: rawText ?? baseInitData?.rawText,
    rawTextUrl: rawTextUrl ?? baseInitData?.rawTextUrl,
    liveAction: params.get('liveAction') === '1'
      ? true
      : baseInitData?.liveAction,
    liveStream: params.get('liveStream') === '1'
      ? true
      : baseInitData?.liveStream,
    mcpAppData: baseInitData?.mcpAppData,
  };
  if (messages) {
    const parsed = parseJsonParam(messages);
    if (parsed !== undefined) initData.messages = parsed;
  }
  if (actionMocks) {
    const parsed = parseJsonParam(actionMocks);
    if (parsed !== undefined) initData.actionMocks = parsed;
  }
  if (mcpAppData) {
    const parsed = parseJsonParam(mcpAppData);
    if (parsed !== undefined) initData.mcpAppData = parsed;
  }
  return initData;
}

export function parseGlobalPropsFromQuery(): Record<string, unknown> | null {
  const globalProps = new URLSearchParams(window.location.search).get(
    'globalProps',
  );
  if (!globalProps) return null;
  try {
    const parsed = JSON.parse(globalProps) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore
  }
  return null;
}

export function buildGlobalPropsFromInitData(
  initData: InitData | null,
): Record<string, unknown> | null {
  if (!initData) return null;
  const out: Record<string, unknown> = {};
  if (initData.messagesUrl) out.messagesUrl = initData.messagesUrl;
  if (initData.messages !== undefined) out.messages = initData.messages;
  if (initData.actionMocksUrl) out.actionMocksUrl = initData.actionMocksUrl;
  if (initData.actionMocks !== undefined) {
    out.actionMocks = initData.actionMocks;
  }
  if (initData.speed !== undefined) out.speed = initData.speed;
  if (initData.instant !== undefined) out.instant = initData.instant;
  if (initData.playbackMode !== undefined) {
    out.playbackMode = initData.playbackMode;
  }
  if (initData.theme !== undefined) out.theme = initData.theme;
  if (initData.rawText !== undefined) out.rawText = initData.rawText;
  if (initData.rawTextUrl !== undefined) out.rawTextUrl = initData.rawTextUrl;
  if (initData.playbackPaused !== undefined) {
    out.playbackPaused = initData.playbackPaused;
  }
  if (initData.liveAction !== undefined) out.liveAction = initData.liveAction;
  if (initData.liveStream !== undefined) out.liveStream = initData.liveStream;
  if (initData.mcpAppData !== undefined) {
    out.mcpAppData = initData.mcpAppData;
  }
  return Object.keys(out).length > 0 ? out : null;
}
