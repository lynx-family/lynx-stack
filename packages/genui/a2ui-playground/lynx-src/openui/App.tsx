// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  OpenUiRenderer,
  createOpenUiLibrary,
  createStreamingParser,
} from '@lynx-js/openui-reactlynx';
import type { ActionEvent, ParseResult } from '@lynx-js/openui-reactlynx';
import { useCallback, useEffect, useMemo, useState } from '@lynx-js/react';

import { OPENUI_SCENARIOS } from './mockData.js';

const mockData = OPENUI_SCENARIOS[0].raw;

export function App() {
  const openUiLibrary = useMemo(() => createOpenUiLibrary(), []);

  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    try {
      const streamParser = createStreamingParser(openUiLibrary.toJSONSchema());
      const result = streamParser.push(mockData);
      if (!cancelled) {
        setParseResult(result);
      }
    } catch (e) {
      if (!cancelled) {
        setError(String(e));
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [openUiLibrary]);

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
          <scroll-view scroll-y style={{ height: '100%' }}>
            <OpenUiRenderer
              result={parseResult}
              library={openUiLibrary}
              onAction={onOpenUiAction}
              isStreaming={false}
            />
          </scroll-view>
        )
        : null}
    </view>
  );
}
