// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useEffect, useState } from 'react';

import { usePreviewMetrics } from './metrics.js';
import { HtmlView } from '../components/HtmlView.js';
import { loadReactWebDocument } from '../utils/reactWebPreview.js';
import { RENDER_NAVIGATION_TOKEN_QUERY_PARAM } from '../utils/renderUrl.js';

export function ReactWebRender() {
  const [source, setSource] = useState<string>();
  const [error, setError] = useState<string>();
  const { scheduleFcpFallbackMetric, scheduleFmpMetric, scheduleTtiMetric } =
    usePreviewMetrics();

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(window.location.search);
    void loadReactWebDocument(params.get('sourceUrl'), controller.signal)
      .then(html => {
        if (!controller.signal.aborted) setSource(html);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Preview failed');
        }
      });
    return () => controller.abort();
  }, []);

  if (error) return <p role='alert'>{error}</p>;
  if (source === undefined) return <p>Loading ReactWeb preview...</p>;
  return (
    <HtmlView
      className='reactWebRender'
      title='ReactWeb preview'
      source={source}
      onLoad={() => {
        scheduleFcpFallbackMetric();
        scheduleFmpMetric();
        scheduleTtiMetric();
        window.parent.postMessage({
          type: 'A2UI_RENDER_READY',
          frameUrl: window.location.href,
          navigationToken: new URLSearchParams(window.location.search).get(
            RENDER_NAVIGATION_TOKEN_QUERY_PARAM,
          ) ?? '',
        }, '*');
      }}
    />
  );
}
