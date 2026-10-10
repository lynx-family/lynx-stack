// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useCallback, useEffect, useRef } from 'react';

import { useBundledRender } from './bundled.js';
import type { OpenUILiveResponse } from '../../lynx-src/openui/liveResponse.js';
import { readOpenUILiveResponse } from '../../lynx-src/openui/liveResponse.js';
import {
  OPENUI_RENDER_ERRORS_MESSAGE_TYPE,
  readOpenUIRenderErrors,
} from '../../lynx-src/openui/renderErrors.js';

export function OpenUIRender() {
  const runtime = useBundledRender();
  const {
    view,
    initData,
    setInitData,
    lynxViewRef,
    previewNavigationToken,
  } = runtime;

  const readyRef = useRef(false);
  const pendingRef = useRef<
    { response: OpenUILiveResponse; startedAt: number } | null
  >(null);
  const flush = useCallback(() => {
    const pending = pendingRef.current;
    const view = lynxViewRef.current;
    if (!readyRef.current || !pending || !view?.sendGlobalEvent) return;
    pendingRef.current = null;
    view.sendGlobalEvent('OPENUI_LIVE_RESPONSE', [pending.response]);
    if (pending.response.rawText) runtime.scheduleFmpMetric();
    if (pending.response.isStreaming) runtime.clearTtiTimer();
    else runtime.scheduleTtiMetric();
    runtime.scheduleRenderMetric(pending.startedAt);
  }, [
    lynxViewRef,
    runtime.clearTtiTimer,
    runtime.scheduleFmpMetric,
    runtime.scheduleRenderMetric,
    runtime.scheduleTtiMetric,
  ]);
  const markReady = useCallback(() => {
    readyRef.current = true;
    flush();
    if (window.parent === window) return;
    window.parent.postMessage({
      type: 'A2UI_RENDER_READY',
      runtimeReady: true,
      frameUrl: window.location.href,
      navigationToken: previewNavigationToken,
    }, '*');
  }, [flush, previewNavigationToken]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Changed init data reloads the runtime and invalidates readiness.
  useEffect(() => {
    readyRef.current = false;
  }, [initData]);

  useEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      if (
        event.source !== window.parent
        || event.origin !== window.location.origin
      ) return;
      if (!event.data || typeof event.data !== 'object') return;
      const message = event.data as { type?: unknown; messages?: unknown };
      if (
        message.type !== 'A2UI_LIVE_MESSAGES'
        && message.type !== 'A2UI_REPLAY_MESSAGES'
        && message.type !== 'A2UI_ACTION_RESPONSE'
      ) return;
      const next = readOpenUILiveResponse(message.messages);
      if (!next) return;
      pendingRef.current = { response: next, startedAt: performance.now() };
      flush();
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [flush]);

  useEffect(() => {
    const rawTextUrl = initData?.rawTextUrl;
    if (!rawTextUrl) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await window.fetch(rawTextUrl);
        if (!res.ok || cancelled) return;
        const rawText = await res.text();
        if (!cancelled) {
          setInitData(prev =>
            prev && prev.rawTextUrl === rawTextUrl
              ? { ...prev, rawText }
              : prev
          );
        }
      } catch {
        // ignore; the Lynx app will keep its fallback scenario
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initData?.rawTextUrl, setInitData]);

  useEffect(() => {
    const lynxView = lynxViewRef.current;
    if (!lynxView) return;
    lynxView.onNativeModulesCall = (name, data, moduleName) => {
      if (moduleName !== 'bridge') return;
      if (name === 'OPENUI_RUNTIME_READY') {
        markReady();
      } else if (name === 'OPENUI_USER_ACTION') {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: 'OPENUI_USER_ACTION',
            action: data,
          }, '*');
        }
      } else if (name === OPENUI_RENDER_ERRORS_MESSAGE_TYPE) {
        const errors = readOpenUIRenderErrors(data);
        if (errors && window.parent !== window) {
          window.parent.postMessage({
            type: OPENUI_RENDER_ERRORS_MESSAGE_TYPE,
            navigationToken: previewNavigationToken,
            errors,
          }, '*');
        }
      }
    };
    return () => {
      lynxView.onNativeModulesCall = undefined;
    };
  }, [lynxViewRef, markReady, previewNavigationToken]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (
        event.data && typeof event.data === 'object'
        && 'type' in event.data && event.data.type === 'OPENUI_USER_ACTION'
        && window.parent && window.parent !== window
      ) {
        window.parent.postMessage(event.data, '*');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return view;
}
