// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import ReactDOM from 'react-dom/client';

import './styles.css';
import '@lynx-js/web-core/client';
import '@lynx-js/web-elements/all';
import '@lynx-js/web-elements/index.css';

import { decodeBase64Url } from './utils/base64url.js';
import { DEFAULT_A2UI_DEMO_URL } from './utils/demoUrl.js';
import { RENDER_INIT_DATA_QUERY_PARAM } from './utils/renderUrl.js';

interface InitData {
  protocol?: '0.9' | 'a2ui' | 'openui';
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
}

interface InitLynxViewMessage {
  type: 'INIT_LYNX_VIEW';
  data: InitData;
}

interface PlaybackControlMessage {
  type: 'A2UI_PLAYBACK_CONTROL';
  action: 'pause' | 'resume';
}

interface PlaybackProgressMessage {
  type: 'A2UI_PLAYBACK_PROGRESS';
  data: {
    deliveredCount: number;
    totalCount: number;
    status: 'idle' | 'streaming' | 'paused' | 'done';
  };
}

interface UserActionMessage {
  type: 'A2UI_USER_ACTION';
  action: unknown;
}

interface ActionResponseMessage {
  type: 'A2UI_ACTION_RESPONSE';
  messages: unknown[];
}

interface LiveMessagesMessage {
  type: 'A2UI_LIVE_MESSAGES';
  messages: unknown[];
}

interface LynxViewElement extends HTMLElement {
  initData?: InitData;
  globalProps?: unknown;
  reload?: () => void;
  sendGlobalEvent?: (eventName: string, params: unknown[]) => void;
  onNativeModulesCall?: (
    name: string,
    data: unknown,
    moduleName: string,
  ) => unknown;
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
  return value === '0.9' || value === 'a2ui' || value === 'openui'
    ? value
    : undefined;
}

function readTheme(value: unknown): InitData['theme'] {
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

  return initData;
}

function parseInitDataFromQuery(): InitData | null {
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

  if (
    !baseInitData && !protocol && !messagesUrl && !messages && !demoUrl
    && !demo && !rawText && !rawTextUrl
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
    messages: baseInitData?.messages ?? [], // Default to an empty array
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
  };

  if (messages) {
    const parsed = parseJsonParam(messages);
    if (parsed !== undefined) initData.messages = parsed;
  }

  if (actionMocks) {
    const parsed = parseJsonParam(actionMocks);
    if (parsed !== undefined) initData.actionMocks = parsed;
  }

  return initData;
}

function parseGlobalPropsFromQuery(): Record<string, unknown> | null {
  const params = new URLSearchParams(window.location.search);
  const globalProps = params.get('globalProps');
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

function buildGlobalPropsFromInitData(
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
  return Object.keys(out).length > 0 ? out : null;
}

function isInitLynxViewMessage(data: unknown): data is InitLynxViewMessage {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const payload = data as Partial<InitLynxViewMessage>;
  return payload.type === 'INIT_LYNX_VIEW' && typeof payload.data === 'object'
    && payload.data !== null;
}

function isPlaybackControlMessage(
  data: unknown,
): data is PlaybackControlMessage {
  if (!data || typeof data !== 'object') return false;
  const payload = data as Partial<PlaybackControlMessage>;
  return payload.type === 'A2UI_PLAYBACK_CONTROL'
    && (payload.action === 'pause' || payload.action === 'resume');
}

function Render() {
  const initial = useMemo(() => {
    const initData = parseInitDataFromQuery();
    const globalProps = parseGlobalPropsFromQuery();
    return { initData, globalProps };
  }, []);
  const [initData, setInitData] = useState<InitData | null>(initial.initData);
  const [globalProps] = useState<Record<string, unknown> | null>(
    initial.globalProps,
  );
  const [playbackPaused, setPlaybackPaused] = useState(false);
  const [playbackMode, setPlaybackMode] = useState(false);
  const lynxViewRef = useRef<LynxViewElement | null>(null);
  const lastPlaybackPausedRef = useRef<boolean | null>(null);
  const pendingLiveMessagesRef = useRef<unknown[] | null>(null);
  const pendingActionResponsesRef = useRef<unknown[][]>([]);
  const pendingFlushTimerRef = useRef<number | null>(null);
  const pendingFlushAttemptsRef = useRef(0);

  const postRenderReady = useCallback(() => {
    if (!window.parent || window.parent === window) return;
    window.parent.postMessage({ type: 'A2UI_RENDER_READY' }, '*');
  }, []);

  const hasPendingA2UIEvents = useCallback(() => {
    return pendingLiveMessagesRef.current !== null
      || pendingActionResponsesRef.current.length > 0;
  }, []);

  const flushPendingA2UIEvents = useCallback(() => {
    const lynxView = lynxViewRef.current;
    if (!lynxView || typeof lynxView.sendGlobalEvent !== 'function') {
      return false;
    }

    const liveMessages = pendingLiveMessagesRef.current;
    if (liveMessages) {
      pendingLiveMessagesRef.current = null;
      lynxView.sendGlobalEvent('A2UI_LIVE_MESSAGES', [liveMessages]);
    }

    const actionResponses = pendingActionResponsesRef.current.splice(0);
    for (const messages of actionResponses) {
      lynxView.sendGlobalEvent('A2UI_ACTION_RESPONSE', [messages]);
    }

    return true;
  }, []);

  const schedulePendingA2UIFlush = useCallback(() => {
    if (pendingFlushTimerRef.current !== null) return;

    pendingFlushTimerRef.current = window.setTimeout(() => {
      pendingFlushTimerRef.current = null;
      const flushed = flushPendingA2UIEvents();
      if (flushed || !hasPendingA2UIEvents()) {
        pendingFlushAttemptsRef.current = 0;
        return;
      }

      pendingFlushAttemptsRef.current += 1;
      if (pendingFlushAttemptsRef.current < 200) {
        schedulePendingA2UIFlush();
      }
    }, 50);
  }, [flushPendingA2UIEvents, hasPendingA2UIEvents]);

  // Known demo: fetch the static JSON in the browser context (where fetch works)
  // and pass the resolved messages as initData, avoiding fetch in Lynx's worker thread.
  useEffect(() => {
    const demo = new URLSearchParams(window.location.search).get('demo');
    if (!demo) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await window.fetch(`./demos/${demo}.json`);
        if (!res.ok || cancelled) return;
        const messages = (await res.json()) as unknown;
        if (!cancelled) {
          setInitData((prev) => (prev ? { ...prev, messages } : prev));
        }
      } catch {
        // ignore — will show empty
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const lynxView = lynxViewRef.current;
    if (!lynxView) return;

    lynxView.onNativeModulesCall = (name, data, moduleName) => {
      if (moduleName !== 'bridge') return;
      if (name === 'A2UI_PLAYBACK_SYNC') {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(
            {
              type: 'A2UI_PLAYBACK_SYNC',
              data,
            },
            '*',
          );
        }
        return;
      }
      if (name === 'A2UI_USER_ACTION') {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(
            { type: 'A2UI_USER_ACTION', action: data },
            '*',
          );
        }
        return;
      }
    };

    return () => {
      if (lynxView.onNativeModulesCall === undefined) return;
      lynxView.onNativeModulesCall = undefined;
    };
  }, []);

  useEffect(() => {
    const handleMessage = (e: MessageEvent<unknown>) => {
      if (
        e.data
        && typeof e.data === 'object'
        && (e.data as PlaybackProgressMessage).type === 'A2UI_PLAYBACK_PROGRESS'
      ) {
        const lynxView = lynxViewRef.current;
        lynxView?.sendGlobalEvent?.('A2UI_PLAYBACK_PROGRESS', [
          (e.data as PlaybackProgressMessage).data,
        ]);
        return;
      }
      if (
        e.data
        && typeof e.data === 'object'
        && (e.data as UserActionMessage).type === 'A2UI_USER_ACTION'
      ) {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(e.data, '*');
        }
        return;
      }
      if (
        e.data
        && typeof e.data === 'object'
        && (e.data as ActionResponseMessage).type === 'A2UI_ACTION_RESPONSE'
      ) {
        pendingActionResponsesRef.current.push(
          (e.data as ActionResponseMessage).messages,
        );
        pendingFlushAttemptsRef.current = 0;
        if (!flushPendingA2UIEvents()) {
          schedulePendingA2UIFlush();
        }
        return;
      }
      if (
        e.data
        && typeof e.data === 'object'
        && (e.data as LiveMessagesMessage).type === 'A2UI_LIVE_MESSAGES'
      ) {
        pendingLiveMessagesRef.current = (e.data as LiveMessagesMessage)
          .messages;
        pendingFlushAttemptsRef.current = 0;
        if (!flushPendingA2UIEvents()) {
          schedulePendingA2UIFlush();
        }
        return;
      }
      if (!isInitLynxViewMessage(e.data)) {
        if (!isPlaybackControlMessage(e.data)) return;
        setPlaybackPaused(e.data.action === 'pause');
        return;
      }

      setInitData(e.data.data);
      setPlaybackMode(e.data.data.playbackMode === true);
    };

    window.addEventListener('message', handleMessage);
    postRenderReady();
    return () => window.removeEventListener('message', handleMessage);
  }, [flushPendingA2UIEvents, postRenderReady, schedulePendingA2UIFlush]);

  useEffect(() => {
    const lynxView = lynxViewRef.current;
    if (!lynxView) return;

    lynxView.initData = {
      ...(initData ?? {}),
    };
    // Align with native: prefer `globalProps` as the channel for A2UI payload.
    const nextGlobalProps = globalProps
      ? { ...globalProps }
      : buildGlobalPropsFromInitData(initData) ?? {};
    lynxView.globalProps = nextGlobalProps;

    if (typeof lynxView.reload === 'function') {
      lynxView.reload();
    }
    schedulePendingA2UIFlush();
    postRenderReady();
  }, [globalProps, initData, postRenderReady, schedulePendingA2UIFlush]);

  useEffect(() => {
    const lynxView = lynxViewRef.current;
    if (!lynxView) return;

    const nextGlobalProps = globalProps
      ? { ...globalProps, playbackPaused, playbackMode }
      : buildGlobalPropsFromInitData({
        ...(initData ?? {}),
        playbackPaused,
        playbackMode,
      }) ?? {};

    lynxView.initData = {
      ...(initData ?? {}),
      playbackPaused,
      playbackMode,
    };
    lynxView.globalProps = nextGlobalProps;

    if (lastPlaybackPausedRef.current !== playbackPaused) {
      lastPlaybackPausedRef.current = playbackPaused;
      lynxView.sendGlobalEvent?.('A2UI_PLAYBACK_CONTROL', [
        playbackPaused ? 'pause' : 'resume',
      ]);
    }
    schedulePendingA2UIFlush();
    postRenderReady();
  }, [
    globalProps,
    initData,
    playbackMode,
    playbackPaused,
    postRenderReady,
    schedulePendingA2UIFlush,
  ]);

  useEffect(() => {
    return () => {
      if (pendingFlushTimerRef.current !== null) {
        window.clearTimeout(pendingFlushTimerRef.current);
      }
    };
  }, []);

  return createElement('lynx-view', {
    ref: lynxViewRef,
    className: 'renderLynx',
    style: { height: '100%' },
    'thread-strategy': 'multi-thread',
    url: initData?.demoUrl ?? DEFAULT_A2UI_DEMO_URL,
  });
}

const container = document.getElementById('root');
if (!container) {
  throw new Error('Missing #root element');
}

ReactDOM.createRoot(container).render(<Render />);
