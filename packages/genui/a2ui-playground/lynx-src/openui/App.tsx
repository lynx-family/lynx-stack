// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  OpenUiRenderer,
  createOpenUiLibrary,
  createStreamingParser,
} from '@lynx-js/genui/openui';
import type { ActionEvent, ParseResult } from '@lynx-js/genui/openui';
import {
  useCallback,
  useEffect,
  useGlobalProps,
  useMemo,
  useRef,
  useState,
} from '@lynx-js/react';

import { OPENUI_SCENARIOS } from './mockData.js';

const DEFAULT_CHUNK_SIZE = 8;
const DEFAULT_STREAM_DELAY_MS = 30;

export function App() {
  const globalProps = useGlobalProps() as Record<string, unknown> | null;
  const openUiLibrary = useMemo(() => createOpenUiLibrary(), []);

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

  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const streamParserRef = useRef<
    ReturnType<typeof createStreamingParser> | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setIsStreaming(true);
    setError('');
    setParseResult(null);

    const schema = openUiLibrary.toJSONSchema();
    const streamParser = createStreamingParser(schema);
    streamParserRef.current = streamParser;

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
        const result = streamParser.push(chunk);
        setParseResult(result);
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
      streamParserRef.current = null;
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

      {parseResult?.root
        ? (
          <scroll-view scroll-y style={{ height: '100%', width: '100%' }}>
            <OpenUiRenderer
              result={parseResult}
              library={openUiLibrary}
              onAction={onOpenUiAction}
              isStreaming={isStreaming}
            />
          </scroll-view>
        )
        : null}
    </view>
  );
}
