// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ParseResult } from '@openuidev/lang-core';

import { OpenUiRenderer, createOpenUiLibrary } from '@lynx-js/genui/openui';
import type { ActionEvent, OpenUIError } from '@lynx-js/genui/openui';
import { createOpenUiChatLibrary } from '@lynx-js/genui/openui/chat';
import {
  useCallback,
  useEffect,
  useGlobalProps,
  useLynxGlobalEventListener,
  useMemo,
  useRef,
  useState,
} from '@lynx-js/react';

import { OPENUI_DATA_TOOL, createDataTools } from './dataTools.js';
import { InlineOpenUiRenderer } from './InlineOpenUiRenderer.jsx';
import type { OpenUILiveResponse } from './liveResponse.js';
import { readOpenUILiveResponse } from './liveResponse.js';
import { OPENUI_SCENARIOS } from './mockData.js';
import {
  OPENUI_RENDER_ERRORS_MESSAGE_TYPE,
  formatOpenUIRenderErrors,
} from './renderErrors.js';
import { loadOpenUIResponse } from './source.js';

const DEFAULT_CHUNK_SIZE = 8;
const DEFAULT_STREAM_DELAY_MS = 30;
const OPENUI_PLAYBACK_CHUNK_SIZE = 240;

type Theme = 'light' | 'dark';

function chunkOpenUIResponse(rawText: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < rawText.length; i += OPENUI_PLAYBACK_CHUNK_SIZE) {
    chunks.push(rawText.slice(i, i + OPENUI_PLAYBACK_CHUNK_SIZE));
  }
  return chunks;
}

function readTheme(value: unknown): Theme | null {
  if (value === 'light' || value === 'dark') return value;
  if (value === 'Light') return 'light';
  if (value === 'Dark') return 'dark';
  return null;
}

export function App() {
  const globalProps = useGlobalProps() as Record<string, unknown> | null;
  const inlineMode = globalProps?.inlineMode === true
    || globalProps?.inlineMode === '1';
  const Renderer = inlineMode ? InlineOpenUiRenderer : OpenUiRenderer;
  const useChatLibrary = globalProps?.openuiLibrary === 'chat';
  const openUiLibrary = useMemo(
    () => useChatLibrary ? createOpenUiChatLibrary() : createOpenUiLibrary(),
    [useChatLibrary],
  );
  const liveStream = globalProps?.liveStream === true;
  const liveAction = useMemo(() => {
    const value = globalProps?.liveAction;
    return value === true || value === '1' || value === 1;
  }, [globalProps]);

  const dataTools = useMemo(() =>
    createDataTools(request => {
      'background only';
      return new Promise((resolve, reject) => {
        if (!NativeModules.bridge?.call) {
          reject(new Error('OpenUI local storage bridge is unavailable'));
          return;
        }
        const timer = setTimeout(
          () => reject(new Error('OpenUI local storage request timed out')),
          5000,
        );
        try {
          NativeModules.bridge.call(OPENUI_DATA_TOOL, { ...request }, reply => {
            clearTimeout(timer);
            resolve(reply);
          });
        } catch (error) {
          clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    }), []);
  const rawTextUrl = typeof globalProps?.rawTextUrl === 'string'
    ? globalProps.rawTextUrl
    : undefined;
  const hasInlineSource = typeof globalProps?.rawText === 'string';
  const [remoteSource, setRemoteSource] = useState<
    { url: string; text: string } | null
  >(null);
  const openUiToolProvider = useMemo<
    Record<string, (args: Record<string, unknown>) => unknown>
  >(() => {
    return {
      ...dataTools.tools,
      get_weather(args) {
        const city = typeof args.city === 'string' ? args.city : 'Seattle';
        if (city === 'San Francisco') {
          return {
            city,
            temp: 64,
            condition: 'Fog clearing',
            high: 68,
            low: 55,
            humidity: '72%',
            wind: '11 mph',
            updated: 'mocked just now',
            alerts: ['Marine layer expected this evening.'],
          };
        }
        return {
          city: 'Seattle',
          temp: 71,
          condition: 'Partly cloudy',
          high: 76,
          low: 58,
          humidity: '61%',
          wind: '8 mph',
          updated: 'mocked just now',
          alerts: [],
        };
      },
      get_release_queue() {
        return {
          count: 3,
          next: 'Ship OpenUI v0.5 playground cases',
          owner: 'GenUI',
        };
      },
      save_release_note(args) {
        return {
          ok: true,
          id: 'release-note-openui-v05',
          saved: args,
        };
      },
    };
  }, [dataTools]);

  // Keep host-restored Query values with inline and remotely loaded sources.
  const initialData = useMemo(() => {
    const text = globalProps?.rawText;
    const initial = globalProps?.initialQueryResults;
    const restoredData = initial !== null && typeof initial === 'object'
        && !Array.isArray(initial)
      ? { initialQueryResults: initial as Record<string, unknown> }
      : {};
    if (typeof text === 'string' && (text.length > 0 || liveStream)) {
      return {
        rawText: text,
        ...restoredData,
      };
    }
    if (rawTextUrl) {
      return {
        rawText: remoteSource?.url === rawTextUrl ? remoteSource.text : '',
        ...restoredData,
      };
    }
    return { rawText: OPENUI_SCENARIOS[0].raw, ...restoredData };
  }, [globalProps, liveStream, rawTextUrl, remoteSource]);
  const rawText = initialData.rawText;

  const instant = useMemo(() => {
    const value = globalProps?.instant;
    return value === true || value === '1' || value === 1;
  }, [globalProps]);

  const playbackMode = useMemo(() => {
    const value = globalProps?.playbackMode;
    return value === true || value === '1' || value === 1;
  }, [globalProps]);

  const theme = useMemo<Theme>(() => {
    return readTheme(globalProps?.theme) ?? 'light';
  }, [globalProps]);
  const benchMode = globalProps?.benchMode === true;
  const layoutClassName = benchMode
    ? 'openui-bench'
    : (inlineMode ? 'openui-inline' : 'openui-editorial');
  const themeClassName = theme === 'dark'
    ? `openui-page ${layoutClassName} openui-dark luna-dark`
    : `openui-page ${layoutClassName} openui-light luna-light`;

  // Speed multiplier from globalProps (e.g. ?speed=2)
  const streamDelay = useMemo(() => {
    const raw = globalProps?.speed;
    const speed = typeof raw === 'string'
      ? Number(raw)
      : (typeof raw === 'number' ? raw : 1);
    if (!speed || speed <= 0) return DEFAULT_STREAM_DELAY_MS;
    return DEFAULT_STREAM_DELAY_MS / speed;
  }, [globalProps]);

  const [{ response, isStreaming, initialQueryResults }, setOutput] = useState<
    {
      response: string;
      isStreaming: boolean;
      initialQueryResults?: Record<string, unknown>;
    }
  >({
    response: '',
    isStreaming: false,
  });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  useEffect(() => {
    if (!rawTextUrl || hasInlineSource) return;
    let active = true;
    void loadOpenUIResponse(rawTextUrl).then(text => {
      if (active) setRemoteSource({ url: rawTextUrl, text });
    }).catch(error => {
      if (active) setError(String(error));
    });
    return () => {
      active = false;
    };
  }, [rawTextUrl, hasInlineSource]);
  const [playbackTargetCount, setPlaybackTargetCount] = useState(0);
  const playbackPausedRef = useRef(false);
  const playbackChunks = useMemo(() => chunkOpenUIResponse(rawText), [rawText]);

  const onOpenUiError = useCallback((errors: OpenUIError[]) => {
    'background only';
    const firstError = formatOpenUIRenderErrors(errors.slice(0, 1));
    setError(
      errors.length > 1
        ? `${errors.length} OpenUI errors\n${firstError}`
        : firstError,
    );
    NativeModules.bridge?.call?.(
      OPENUI_RENDER_ERRORS_MESSAGE_TYPE,
      { errors },
      () => undefined,
    );
  }, []);

  useLynxGlobalEventListener('OPENUI_LIVE_RESPONSE', (payload: unknown) => {
    'background only';
    if (!liveStream) return;
    const next = readOpenUILiveResponse(payload);
    if (!next) return;
    dataTools.setScope(next.rawText);
    onOpenUiError([]);
    setOutput({
      response: next.rawText,
      isStreaming: next.isStreaming,
      ...(next.initialQueryResults
        ? { initialQueryResults: next.initialQueryResults }
        : {}),
    });
    setLoading(false);
  });

  useEffect(() => {
    setPlaybackTargetCount(0);
    playbackPausedRef.current = false;
  }, [playbackMode, rawText]);

  useLynxGlobalEventListener(
    'A2UI_PLAYBACK_CONTROL',
    (action: unknown) => {
      playbackPausedRef.current = action === 'pause';
    },
  );

  useLynxGlobalEventListener(
    'A2UI_PLAYBACK_PROGRESS',
    (payload: unknown) => {
      if (!playbackMode) return;
      if (!payload || typeof payload !== 'object') return;
      const next = (payload as { deliveredCount?: unknown }).deliveredCount;
      const nextCount = typeof next === 'number'
        ? next
        : (typeof next === 'string' ? Number(next) : Number.NaN);
      if (!Number.isFinite(nextCount) || nextCount < 0) return;
      setPlaybackTargetCount(Math.floor(nextCount));
    },
  );

  useEffect(() => {
    let cancelled = false;
    const initial: OpenUILiveResponse = {
      rawText,
      isStreaming: !instant,
      ...(initialData.initialQueryResults
        ? { initialQueryResults: initialData.initialQueryResults }
        : {}),
    };
    dataTools.setScope(initial.rawText);
    setLoading(true);
    setOutput({
      response: '',
      isStreaming: true,
      ...(initialData.initialQueryResults
        ? { initialQueryResults: initialData.initialQueryResults }
        : {}),
    });
    onOpenUiError([]);

    if (liveStream) {
      setOutput({
        response: rawText,
        isStreaming: true,
        ...(initialData.initialQueryResults
          ? { initialQueryResults: initialData.initialQueryResults }
          : {}),
      });
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (instant) {
      setOutput({
        response: rawText,
        isStreaming: false,
        ...(initialData.initialQueryResults
          ? { initialQueryResults: initialData.initialQueryResults }
          : {}),
      });
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (playbackMode) {
      const next = playbackChunks.slice(0, playbackTargetCount).join('');
      setOutput({
        response: next,
        isStreaming: playbackTargetCount < playbackChunks.length,
        ...(initialData.initialQueryResults
          ? { initialQueryResults: initialData.initialQueryResults }
          : {}),
      });
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    let offset = 0;

    const tick = () => {
      if (cancelled) return;
      if (offset >= rawText.length) {
        setOutput(current => ({ ...current, isStreaming: false }));
        return;
      }

      try {
        const chunk = rawText.slice(offset, offset + DEFAULT_CHUNK_SIZE);
        offset += DEFAULT_CHUNK_SIZE;
        setOutput(current => ({
          ...current,
          response: current.response + chunk,
          isStreaming: true,
        }));
        setLoading(false);
      } catch (e) {
        setError(String(e));
        setOutput({ response: '', isStreaming: false });
        setLoading(false);
        return;
      }

      setTimeout(tick, streamDelay);
    };

    tick();

    return () => {
      cancelled = true;
    };
  }, [
    initialData,
    dataTools,
    instant,
    liveStream,
    onOpenUiError,
    openUiLibrary,
    playbackChunks,
    playbackMode,
    playbackTargetCount,
    rawText,
    streamDelay,
  ]);

  useEffect(() => {
    NativeModules.bridge?.call?.('OPENUI_RUNTIME_READY', {}, () => undefined);
  }, []);

  const onParseResult = useCallback((result: ParseResult | null) => {
    'background only';
    if (!result || !response) return;
    // Playback tools use the full artifact identity, not the current text prefix.
    const source = liveStream ? response : rawText;
    dataTools.publishParseResult(source, result, response);
  }, [dataTools, liveStream, rawText, response]);

  useEffect(() => () => dataTools.dispose(), [dataTools]);

  const onOpenUiAction = useCallback((event: ActionEvent) => {
    'background only';
    if (!liveAction) return;
    NativeModules.bridge?.call?.(
      'OPENUI_USER_ACTION',
      event as unknown as Record<string, unknown>,
      () => undefined,
    );
  }, [liveAction]);

  return (
    <view className={themeClassName}>
      {error
        ? (
          <view className='openui-feedback'>
            <text className='openui-error' text-maxline={6}>{error}</text>
          </view>
        )
        : null}

      {loading
        ? (
          <view className='openui-feedback'>
            <text>Loading...</text>
          </view>
        )
        : null}

      {liveStream || response
        ? (
          <scroll-view scroll-y className='openui-scroll'>
            <Renderer
              response={response}
              isStreaming={isStreaming}
              library={openUiLibrary}
              initialQueryResults={initialQueryResults}
              toolProvider={openUiToolProvider}
              onParseResult={onParseResult}
              onAction={onOpenUiAction}
              onError={onOpenUiError}
            />
          </scroll-view>
        )
        : null}
    </view>
  );
}
