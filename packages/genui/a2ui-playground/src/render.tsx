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
import { DEFAULT_DEMO_URL } from './utils/demoUrl.js';

interface InitData {
  protocol?: '0.9';
  messagesUrl?: string;
  messages?: unknown;
  actionMocksUrl?: string;
  actionMocks?: unknown;
  demoUrl?: string;
}

interface InitLynxViewMessage {
  type: 'INIT_LYNX_VIEW';
  data: InitData;
}

interface LynxViewElement extends HTMLElement {
  initData?: InitData;
  reload?: () => void;
}

function parseInitDataFromQuery(): InitData | null {
  const params = new URLSearchParams(window.location.search);

  const protocol = params.get('protocol');
  const messagesUrl = params.get('messagesUrl');
  const demoUrl = params.get('demoUrl');
  const messages = params.get('messages');
  const actionMocks = params.get('actionMocks');
  const actionMocksUrl = params.get('actionMocksUrl');

  if (!protocol && !messagesUrl && !messages && !demoUrl) {
    return null;
  }

  const protocolValue = protocol === '0.9' ? '0.9' : undefined;

  const initData: InitData = {
    protocol: protocolValue,
    messagesUrl: messagesUrl ?? undefined,
    actionMocksUrl: actionMocksUrl ?? undefined,
    demoUrl: demoUrl ?? undefined,
    messages: [], // Default to an empty array
  };

  if (messages) {
    try {
      const decoded = decodeBase64Url(messages);
      initData.messages = JSON.parse(decoded);
    } catch {
      // ignore
    }
  }

  if (actionMocks) {
    try {
      const decoded = decodeBase64Url(actionMocks);
      initData.actionMocks = JSON.parse(decoded);
    } catch {
      // ignore
    }
  }

  return initData;
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
  const initial = useMemo(() => parseInitDataFromQuery(), []);
  const [initData, setInitData] = useState<InitData | null>(initial);
  const lynxViewRef = useRef<LynxViewElement | null>(null);

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

    if (typeof lynxView.reload === 'function') {
      lynxView.reload();
    }
  }, [initData]);

  return createElement('lynx-view', {
    ref: lynxViewRef,
    className: 'renderLynx',
    style: { height: '100%' },
    'thread-strategy': 'multi-thread',
    url: initData?.demoUrl ?? DEFAULT_DEMO_URL,
  });
}

const container = document.getElementById('root');
if (!container) {
  throw new Error('Missing #root element');
}

ReactDOM.createRoot(container).render(<Render />);
