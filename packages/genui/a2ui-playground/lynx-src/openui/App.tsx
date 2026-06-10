// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { OpenUiRenderer, createOpenUiLibrary } from '@lynx-js/genui/openui';
import type { ActionEvent } from '@lynx-js/genui/openui';
import {
  useCallback,
  useEffect,
  useGlobalProps,
  useMemo,
  useState,
} from '@lynx-js/react';

import { OPENUI_SCENARIOS } from './mockData.js';

const DEFAULT_CHUNK_SIZE = 8;
const DEFAULT_STREAM_DELAY_MS = 30;

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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setIsStreaming(true);
    setError('');
    setResponse('');

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
  }, [openUiLibrary, rawText, streamDelay]);

  const onOpenUiAction = useCallback((_event: ActionEvent) => {
    // noop for now
  }, []);

  return (
    <view style={{ width: '100%', height: '100%', backgroundColor: '#fff' }}>
      {error
        ? (
          <view style={{ padding: '12px' }}>
            <text style={{ color: '#c40000' }}>{error}</text>
          </view>
        )
        : null}

      {loading
        ? (
          <view style={{ padding: '12px' }}>
            <text>Loading...</text>
          </view>
        )
        : null}

      {response
        ? (
          <scroll-view scroll-y style={{ height: '100%', width: '100%' }}>
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
