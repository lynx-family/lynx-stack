// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';

import './styles.css';
import '@lynx-js/web-core/client';
import '@lynx-js/web-elements/all';
import '@lynx-js/web-elements/index.css';

import { decodeBase64Url } from './utils/base64url.js';
import { DEFAULT_A2UI_DEMO_URL } from './utils/demoUrl.js';

interface InitData {
  protocol?: '0.9';
  messagesUrl?: string;
  messages?: unknown;
  actionMocksUrl?: string;
  actionMocks?: unknown;
  demoUrl?: string;
  speed?: number;
}

interface InitLynxViewMessage {
  type: 'INIT_LYNX_VIEW';
  data: InitData;
}

interface LynxViewElement extends HTMLElement {
  initData?: InitData;
  globalProps?: unknown;
  reload?: () => void;
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

function parseInitDataFromQuery(): InitData | null {
  const params = new URLSearchParams(window.location.search);

  const protocol = params.get('protocol');
  const messagesUrl = params.get('messagesUrl');
  const demoUrl = params.get('demoUrl');
  const messages = params.get('messages');
  const actionMocks = params.get('actionMocks');
  const actionMocksUrl = params.get('actionMocksUrl');
  const demo = params.get('demo');

  if (!protocol && !messagesUrl && !messages && !demoUrl && !demo) {
    return null;
  }

  const protocolValue = protocol === '0.9' ? '0.9' : undefined;

  const speedRaw = params.get('speed');
  const speedVal = speedRaw === null ? undefined : Number(speedRaw);

  const initData: InitData = {
    protocol: protocolValue,
    messagesUrl: messagesUrl ?? undefined,
    actionMocksUrl: actionMocksUrl ?? undefined,
    demoUrl: demoUrl ?? undefined,
    messages: [], // Default to an empty array
    speed: speedVal && Number.isFinite(speedVal) && speedVal > 0
      ? speedVal
      : undefined,
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
  const lynxViewRef = useRef<LynxViewElement | null>(null);

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
    const handleMessage = (e: MessageEvent<unknown>) => {
      if (!isInitLynxViewMessage(e.data)) {
        return;
      }

      setInitData(e.data.data);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    const lynxView = lynxViewRef.current;
    if (!lynxView) return;

    lynxView.initData = initData ?? {};
    // Align with native: prefer `globalProps` as the channel for A2UI payload.
    lynxView.globalProps = globalProps ?? buildGlobalPropsFromInitData(initData)
      ?? {};

    if (typeof lynxView.reload === 'function') {
      lynxView.reload();
    }
  }, [globalProps, initData]);

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
