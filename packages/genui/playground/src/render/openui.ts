// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useCallback, useEffect, useRef } from 'react';

import { useBundledRender } from './bundled.js';
import {
  OPENUI_DATA_TOOL,
  OPENUI_QUERY_DEFAULTS,
} from '../../lynx-src/openui/dataTools.js';
import type { OpenUILiveResponse } from '../../lynx-src/openui/liveResponse.js';
import { readOpenUILiveResponse } from '../../lynx-src/openui/liveResponse.js';
import {
  OPENUI_RENDER_ERRORS_MESSAGE_TYPE,
  readOpenUIRenderErrors,
} from '../../lynx-src/openui/renderErrors.js';
import { resolveOpenUIExampleAssets } from '../mock/openui-chat-assets.js';
import {
  executeOpenUIDataTool,
  restoreOpenUIData,
} from '../openui/dataHost.js';

function prepareOpenUIData<T extends { rawText?: string }>(data: T): T {
  try {
    return restoreOpenUIData(data, window.localStorage);
  } catch (error) {
    // Keep corrupt storage untouched; Query execution and the inspector report it.
    console.error('Unable to restore OpenUI local data', error);
    return data;
  }
}

export function OpenUIRender() {
  const runtime = useBundledRender(prepareOpenUIData);
  const {
    view,
    initData,
    setInitData,
    lynxViewRef,
    previewNavigationToken,
  } = runtime;

  const queryDefaultsRef = useRef(new Map<string, Record<string, unknown>>());
  const readyRef = useRef(false);
  const pendingRef = useRef<
    { response: OpenUILiveResponse; startedAt: number } | null
  >(null);
  const flush = useCallback(() => {
    const pending = pendingRef.current;
    const view = lynxViewRef.current;
    if (!readyRef.current || !pending || !view?.sendGlobalEvent) return;
    pendingRef.current = null;
    view.sendGlobalEvent('OPENUI_LIVE_RESPONSE', [
      prepareOpenUIData(pending.response),
    ]);
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
        const rawText = resolveOpenUIExampleAssets(
          await res.text(),
          window.location.href,
        );
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
      if (name === OPENUI_DATA_TOOL) {
        try {
          if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('Unknown OpenUI data resource');
          }
          const request = data as Record<string, unknown>;
          const source = request.rawText;
          if (typeof source !== 'string') {
            throw new Error('Unknown OpenUI data resource');
          }
          if (request.operation === 'initialize') {
            const args = request.args;
            if (!args || typeof args !== 'object' || Array.isArray(args)) {
              throw new Error('Invalid OpenUI Query defaults');
            }
            const defaults = (args as Record<string, unknown>).defaults;
            if (
              !defaults || typeof defaults !== 'object'
              || Array.isArray(defaults)
            ) {
              throw new Error('Invalid OpenUI Query defaults');
            }
            const cache = queryDefaultsRef.current;
            cache.delete(source);
            cache.set(source, defaults as Record<string, unknown>);
            if (cache.size > 16) cache.delete(cache.keys().next().value!);
            if (window.parent !== window) {
              window.parent.postMessage({
                type: OPENUI_QUERY_DEFAULTS,
                rawText: source,
                defaults,
                navigationToken: previewNavigationToken,
              }, window.location.origin);
            }
            return { ok: true };
          }
          const defaults = queryDefaultsRef.current.get(source);
          if (!defaults) throw new Error('OpenUI Query defaults are not ready');
          return executeOpenUIDataTool(
            data,
            window.localStorage,
            defaults,
          );
        } catch (error) {
          return { ok: false, error: String(error) };
        }
      }
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
