// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { OpenUiRenderer, createOpenUiLibrary } from '@lynx-js/genui/openui';
import type { ActionEvent } from '@lynx-js/genui/openui';
import {
  useCallback,
  useEffect,
  useGlobalProps,
  useLynxGlobalEventListener,
  useMemo,
  useRef,
  useState,
} from '@lynx-js/react';

import { OPENUI_SCENARIOS } from './mockData.js';

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
  const openUiLibrary = useMemo(() => createOpenUiLibrary(), []);
  const openUiToolProvider = useMemo<
    Record<string, (args: Record<string, unknown>) => unknown>
  >(() => ({
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
  }), []);

  // Read rawText from globalProps; fall back to hardcoded mock data.
  const rawText = useMemo(() => {
    const text = globalProps?.rawText;
    if (typeof text === 'string' && text.length > 0) {
      return text;
    }
    return OPENUI_SCENARIOS[0].raw;
  }, [globalProps]);

  const instant = useMemo(() => {
    const value = globalProps?.instant;
    return value === true || value === '1' || value === 1;
  }, [globalProps]);

  const playbackMode = useMemo(() => {
    const value = globalProps?.playbackMode;
    return value === true || value === '1' || value === 1;
  }, [globalProps]);

  const liveAction = useMemo(() => {
    const value = globalProps?.liveAction;
    return value === true || value === '1' || value === 1;
  }, [globalProps]);

  const theme = useMemo<Theme>(() => {
    return readTheme(globalProps?.theme) ?? 'light';
  }, [globalProps]);
  const themeClassName = theme === 'dark'
    ? 'openui-page openui-dark luna-dark'
    : 'openui-page openui-light luna-light';

  // Speed multiplier from globalProps (e.g. ?speed=2)
  const streamDelay = useMemo(() => {
    const raw = globalProps?.speed;
    const speed = typeof raw === 'string'
      ? Number(raw)
      : (typeof raw === 'number' ? raw : 1);
    if (!speed || speed <= 0) return DEFAULT_STREAM_DELAY_MS;
    return DEFAULT_STREAM_DELAY_MS / speed;
  }, [globalProps]);

  const [response, setResponse] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [playbackTargetCount, setPlaybackTargetCount] = useState(0);
  const playbackPausedRef = useRef(false);
  const playbackChunks = useMemo(() => chunkOpenUIResponse(rawText), [rawText]);

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
    setLoading(true);
    setIsStreaming(true);
    setError('');
    setResponse('');

    if (instant) {
      setResponse(rawText);
      setIsStreaming(false);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (playbackMode) {
      const next = playbackChunks.slice(0, playbackTargetCount).join('');
      setResponse(next);
      setIsStreaming(playbackTargetCount < playbackChunks.length);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    let offset = 0;

    const tick = () => {
      if (cancelled) return;
      if (offset >= rawText.length) {
        setIsStreaming(false);
        return;
      }

      try {
        const chunk = rawText.slice(offset, offset + DEFAULT_CHUNK_SIZE);
        offset += DEFAULT_CHUNK_SIZE;
        setResponse((prev) => prev + chunk);
        setLoading(false);
      } catch (e) {
        setError(String(e));
        setIsStreaming(false);
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
    instant,
    openUiLibrary,
    playbackChunks,
    playbackMode,
    playbackTargetCount,
    rawText,
    streamDelay,
  ]);

  const onOpenUiAction = useCallback((event: ActionEvent) => {
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
            <text className='openui-error'>{error}</text>
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

      {response
        ? (
          <scroll-view scroll-y className='openui-scroll'>
            <OpenUiRenderer
              response={response}
              library={openUiLibrary}
              toolProvider={openUiToolProvider}
              onAction={onOpenUiAction}
              isStreaming={isStreaming}
            />
          </scroll-view>
        )
        : null}
    </view>
  );
}
