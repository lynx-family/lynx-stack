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

import '@lynx-js/web-core/client';
import '@lynx-js/web-elements/all';
import '@lynx-js/web-elements/index.css';

import { TTI_READY_FALLBACK_MS, usePreviewMetrics } from './metrics.js';
import {
  buildGlobalPropsFromInitData,
  parseGlobalPropsFromQuery,
  parseInitDataFromQuery,
} from './query.js';
import type { InitData } from './query.js';
import { DEFAULT_A2UI_DEMO_URL } from '../utils/demoUrl.js';
import { RENDER_NAVIGATION_TOKEN_QUERY_PARAM } from '../utils/renderUrl.js';

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

interface InitLynxViewMessage {
  type: 'INIT_LYNX_VIEW';
  data: InitData;
}

interface PlaybackControlMessage {
  type: 'A2UI_PLAYBACK_CONTROL';
  action: 'pause' | 'resume';
}

function isInitLynxViewMessage(data: unknown): data is InitLynxViewMessage {
  if (!data || typeof data !== 'object') return false;
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

// The bundled protocols share a view lifecycle and the legacy playback channel.
// Each protocol component installs its own payload and action bridges.
export function useBundledRender() {
  const initial = useMemo(() => ({
    initData: parseInitDataFromQuery(),
    globalProps: parseGlobalPropsFromQuery(),
  }), []);
  const [initData, setInitData] = useState<InitData | null>(initial.initData);
  const [globalProps] = useState(initial.globalProps);
  const [playbackPaused, setPlaybackPaused] = useState(false);
  const [playbackMode, setPlaybackMode] = useState(false);
  const lynxViewRef = useRef<LynxViewElement | null>(null);
  const initDataRef = useRef(initData);
  const lastPlaybackPausedRef = useRef<boolean | null>(null);
  const previewNavigationToken = useMemo(
    () =>
      new URLSearchParams(window.location.search).get(
        RENDER_NAVIGATION_TOKEN_QUERY_PARAM,
      ) ?? '',
    [],
  );
  const metrics = usePreviewMetrics();
  const { scheduleFcpFallbackMetric, scheduleFmpMetric, scheduleTtiMetric } =
    metrics;
  const postRenderReady = useCallback(() => {
    if (!window.parent || window.parent === window) return;
    window.parent.postMessage({
      type: 'A2UI_RENDER_READY',
      frameUrl: window.location.href,
      navigationToken: previewNavigationToken,
    }, '*');
    scheduleFcpFallbackMetric();
    if (initDataRef.current?.protocol !== 'a2ui') {
      scheduleFmpMetric();
      scheduleTtiMetric(TTI_READY_FALLBACK_MS);
    }
  }, [
    previewNavigationToken,
    scheduleFcpFallbackMetric,
    scheduleFmpMetric,
    scheduleTtiMetric,
  ]);

  useEffect(() => {
    initDataRef.current = initData;
  }, [initData]);

  useEffect(() => {
    const theme = initData?.theme ?? 'light';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [initData?.theme]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (
        event.data && typeof event.data === 'object'
        && 'type' in event.data
        && event.data.type === 'A2UI_PLAYBACK_PROGRESS'
        && 'data' in event.data
      ) {
        lynxViewRef.current?.sendGlobalEvent?.('A2UI_PLAYBACK_PROGRESS', [
          event.data.data,
        ]);
      } else if (isInitLynxViewMessage(event.data)) {
        setInitData(event.data.data);
        setPlaybackMode(event.data.data.playbackMode === true);
      } else if (isPlaybackControlMessage(event.data)) {
        setPlaybackPaused(event.data.action === 'pause');
      }
    };
    window.addEventListener('message', handleMessage);
    postRenderReady();
    return () => window.removeEventListener('message', handleMessage);
  }, [postRenderReady]);

  useEffect(() => {
    const lynxView = lynxViewRef.current;
    if (!lynxView) return;
    lynxView.initData = { ...(initData ?? {}) };
    // Align with native: prefer globalProps as the payload channel.
    lynxView.globalProps = globalProps
      ? { ...globalProps }
      : buildGlobalPropsFromInitData(initData) ?? {};
    lynxView.reload?.();
    postRenderReady();
  }, [globalProps, initData, postRenderReady]);

  useEffect(() => {
    const lynxView = lynxViewRef.current;
    if (!lynxView) return;
    lynxView.initData = { ...(initData ?? {}), playbackPaused, playbackMode };
    lynxView.globalProps = globalProps
      ? { ...globalProps, playbackPaused, playbackMode }
      : buildGlobalPropsFromInitData({
        ...(initData ?? {}),
        playbackPaused,
        playbackMode,
      }) ?? {};
    if (lastPlaybackPausedRef.current !== playbackPaused) {
      lastPlaybackPausedRef.current = playbackPaused;
      lynxView.sendGlobalEvent?.('A2UI_PLAYBACK_CONTROL', [
        playbackPaused ? 'pause' : 'resume',
      ]);
    }
    postRenderReady();
  }, [globalProps, initData, playbackMode, playbackPaused, postRenderReady]);

  const view = createElement('lynx-view', {
    ref: lynxViewRef,
    className: 'renderLynx',
    'thread-strategy': 'multi-thread',
    'transform-vh': 'true',
    'transform-vw': 'true',
    url: initData?.demoUrl ?? DEFAULT_A2UI_DEMO_URL,
  });

  return {
    view,
    initData,
    initDataRef,
    setInitData,
    lynxViewRef,
    previewNavigationToken,
    playbackMode,
    playbackPaused,
    ...metrics,
  };
}
