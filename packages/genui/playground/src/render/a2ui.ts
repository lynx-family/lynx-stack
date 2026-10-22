// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useCallback, useEffect, useRef } from 'react';

import { useBundledRender } from './bundled.js';
import { lazyComponentDemo } from '../mock/basic/lazy-component.js';
import { mcpAppDemo } from '../mock/basic/mcp-app.js';

interface UserActionMessage {
  type: 'A2UI_USER_ACTION';
  action: unknown;
}

interface MessagesMessage {
  type: 'A2UI_ACTION_RESPONSE' | 'A2UI_LIVE_MESSAGES' | 'A2UI_REPLAY_MESSAGES';
  messages: unknown[];
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function A2UIRender() {
  const {
    view,
    initData,
    initDataRef,
    setInitData,
    lynxViewRef,
    previewNavigationToken,
    playbackMode,
    playbackPaused,
    clearTtiTimer,
    scheduleFmpMetric,
    scheduleTtiMetric,
    scheduleRenderMetric,
  } = useBundledRender();
  const pendingReplayMessagesRef = useRef<unknown[] | null>(null);
  const pendingLiveMessagesRef = useRef<unknown[] | null>(null);
  const pendingActionResponsesRef = useRef<unknown[][]>([]);
  const pendingReplayMetricStartRef = useRef<number | null>(null);
  const pendingLiveMetricStartRef = useRef<number | null>(null);
  const pendingActionMetricStartsRef = useRef<number[]>([]);
  const pendingFlushTimerRef = useRef<number | null>(null);
  const pendingFlushAttemptsRef = useRef(0);

  const hasPendingA2UIEvents = useCallback(() => {
    return pendingReplayMessagesRef.current !== null
      || pendingLiveMessagesRef.current !== null
      || pendingActionResponsesRef.current.length > 0;
  }, []);

  const flushPendingA2UIEvents = useCallback(() => {
    const lynxView = lynxViewRef.current;
    if (!lynxView || typeof lynxView.sendGlobalEvent !== 'function') {
      return false;
    }
    const replayMessages = pendingReplayMessagesRef.current;
    if (replayMessages) {
      const metricStart = pendingReplayMetricStartRef.current
        ?? performance.now();
      pendingReplayMessagesRef.current = null;
      pendingReplayMetricStartRef.current = null;
      lynxView.sendGlobalEvent('A2UI_REPLAY_MESSAGES', [replayMessages]);
      scheduleFmpMetric();
      scheduleTtiMetric();
      scheduleRenderMetric(metricStart);
    }
    const liveMessages = pendingLiveMessagesRef.current;
    if (liveMessages) {
      const metricStart = pendingLiveMetricStartRef.current
        ?? performance.now();
      pendingLiveMessagesRef.current = null;
      pendingLiveMetricStartRef.current = null;
      lynxView.sendGlobalEvent('A2UI_LIVE_MESSAGES', [liveMessages]);
      scheduleFmpMetric();
      scheduleTtiMetric();
      scheduleRenderMetric(metricStart);
    }
    const actionResponses = pendingActionResponsesRef.current.splice(0);
    const actionMetricStarts = pendingActionMetricStartsRef.current.splice(0);
    for (const [index, messages] of actionResponses.entries()) {
      const metricStart = actionMetricStarts[index] ?? performance.now();
      lynxView.sendGlobalEvent('A2UI_ACTION_RESPONSE', [messages]);
      scheduleFmpMetric();
      scheduleTtiMetric();
      scheduleRenderMetric(metricStart);
    }
    return true;
  }, [lynxViewRef, scheduleFmpMetric, scheduleRenderMetric, scheduleTtiMetric]);

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

  // Resolve known demos in the browser, outside Lynx's worker thread.
  useEffect(() => {
    const demo = new URLSearchParams(window.location.search).get('demo');
    if (!demo) return;
    if (demo === 'lazy-component') {
      setInitData(prev =>
        prev ? { ...prev, messages: lazyComponentDemo } : prev
      );
      return;
    }
    if (demo === 'mcp-app') {
      setInitData(prev => prev ? { ...prev, messages: mcpAppDemo } : prev);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await window.fetch(`./demos/${demo}.json`);
        if (!res.ok || cancelled) return;
        const messages = (await res.json()) as unknown;
        if (!cancelled) {
          setInitData(prev => prev ? { ...prev, messages } : prev);
        }
      } catch {
        // ignore — will show empty
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setInitData]);

  useEffect(() => {
    const lynxView = lynxViewRef.current;
    if (!lynxView) return;
    lynxView.onNativeModulesCall = (name, data, moduleName) => {
      if (moduleName !== 'bridge') return;
      if (name === 'A2UI_PLAYBACK_SYNC') {
        if (data && typeof data === 'object') {
          const payload = data as Record<string, unknown>;
          const status = payload.status;
          const deliveredCount = readFiniteNumber(payload.deliveredCount);
          const totalCount = readFiniteNumber(payload.totalCount);
          const hasDeliveredContent = deliveredCount !== null
            && deliveredCount > 0;
          const isDone = status === 'done'
            || (deliveredCount !== null && totalCount !== null
              && totalCount > 0 && deliveredCount >= totalCount);
          if (hasDeliveredContent || isDone) scheduleFmpMetric();
          if (isDone) scheduleTtiMetric();
          else if (status === 'streaming' || status === 'paused') {
            clearTtiTimer();
          }
        }
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'A2UI_PLAYBACK_SYNC', data }, '*');
        }
      } else if (name === 'A2UI_RUNTIME_READY') {
        if (window.parent && window.parent !== window) {
          const messagesUrl = initDataRef.current?.messagesUrl;
          window.parent.postMessage({
            type: 'A2UI_RENDER_READY',
            runtimeReady: true,
            frameUrl: window.location.href,
            navigationToken: previewNavigationToken,
            ...(messagesUrl ? { messagesUrl } : {}),
          }, '*');
        }
      } else if (
        name === 'A2UI_USER_ACTION' && window.parent && window.parent !== window
      ) {
        window.parent.postMessage(
          { type: 'A2UI_USER_ACTION', action: data },
          '*',
        );
      }
    };
    return () => {
      lynxView.onNativeModulesCall = undefined;
    };
  }, [
    clearTtiTimer,
    initDataRef,
    lynxViewRef,
    previewNavigationToken,
    scheduleFmpMetric,
    scheduleTtiMetric,
  ]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (!event.data || typeof event.data !== 'object') return;
      const payload = event.data as
        | UserActionMessage
        | MessagesMessage;
      switch (payload.type) {
        case 'A2UI_USER_ACTION':
          if (window.parent && window.parent !== window) {
            window.parent.postMessage(payload, '*');
          }
          return;
        case 'A2UI_ACTION_RESPONSE':
          pendingActionMetricStartsRef.current.push(performance.now());
          pendingActionResponsesRef.current.push(payload.messages);
          break;
        case 'A2UI_REPLAY_MESSAGES':
          pendingReplayMetricStartRef.current = performance.now();
          pendingReplayMessagesRef.current = payload.messages;
          break;
        case 'A2UI_LIVE_MESSAGES':
          pendingLiveMetricStartRef.current = performance.now();
          pendingLiveMessagesRef.current = payload.messages;
          break;
        default:
          return;
      }
      pendingFlushAttemptsRef.current = 0;
      if (!flushPendingA2UIEvents()) schedulePendingA2UIFlush();
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [flushPendingA2UIEvents, schedulePendingA2UIFlush]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry pending delivery after view data or playback changes.
  useEffect(() => {
    schedulePendingA2UIFlush();
  }, [initData, playbackMode, playbackPaused, schedulePendingA2UIFlush]);

  useEffect(() => () => {
    if (pendingFlushTimerRef.current !== null) {
      window.clearTimeout(pendingFlushTimerRef.current);
    }
  }, []);

  return view;
}
