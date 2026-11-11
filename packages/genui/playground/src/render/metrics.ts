// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useCallback, useEffect, useMemo, useRef } from 'react';

import { RENDER_METRIC_ID_QUERY_PARAM } from '../utils/renderUrl.js';

type PreviewMetricName = 'fcp' | 'fmp' | 'tti' | 'render';

interface PaintTimingEntryLike {
  name: string;
  startTime: number;
}

const TTI_IDLE_WINDOW_MS = 500;
export const TTI_READY_FALLBACK_MS = 1200;

export function usePreviewMetrics() {
  const previewMetricId = useMemo(
    () =>
      new URLSearchParams(window.location.search).get(
        RENDER_METRIC_ID_QUERY_PARAM,
      ) ?? '',
    [],
  );
  const reportedMetricsRef = useRef<Set<PreviewMetricName>>(new Set());
  const ttiTimerRef = useRef<number | null>(null);

  const postPreviewMetric = useCallback((
    metric: PreviewMetricName,
    value: number,
    options: { repeatable?: boolean } = {},
  ) => {
    if (!previewMetricId) return;
    if (!window.parent || window.parent === window) return;
    if (!options.repeatable && reportedMetricsRef.current.has(metric)) return;
    if (!options.repeatable) {
      reportedMetricsRef.current.add(metric);
    }
    window.parent.postMessage({
      type: 'A2UI_PREVIEW_METRIC',
      metricId: previewMetricId,
      metric,
      value: Math.max(0, Math.round(value)),
    }, '*');
  }, [previewMetricId]);

  const clearTtiTimer = useCallback(() => {
    if (ttiTimerRef.current === null) return;
    window.clearTimeout(ttiTimerRef.current);
    ttiTimerRef.current = null;
  }, []);

  const scheduleTtiMetric = useCallback((delayMs = TTI_IDLE_WINDOW_MS) => {
    if (!previewMetricId || reportedMetricsRef.current.has('tti')) return;
    clearTtiTimer();
    ttiTimerRef.current = window.setTimeout(() => {
      ttiTimerRef.current = null;
      postPreviewMetric('tti', performance.now());
    }, delayMs);
  }, [clearTtiTimer, postPreviewMetric, previewMetricId]);

  const scheduleFmpMetric = useCallback(() => {
    if (!previewMetricId || reportedMetricsRef.current.has('fmp')) return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        postPreviewMetric('fmp', performance.now());
      });
    });
  }, [postPreviewMetric, previewMetricId]);

  const scheduleFcpFallbackMetric = useCallback(() => {
    if (!previewMetricId || reportedMetricsRef.current.has('fcp')) return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        postPreviewMetric('fcp', performance.now());
      });
    });
  }, [postPreviewMetric, previewMetricId]);

  const scheduleRenderMetric = useCallback((startTime: number) => {
    if (!previewMetricId) return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        postPreviewMetric(
          'render',
          performance.now() - startTime,
          { repeatable: true },
        );
      });
    });
  }, [postPreviewMetric, previewMetricId]);

  useEffect(() => {
    if (!previewMetricId) return;
    const reportPaintEntries = (entries: readonly PaintTimingEntryLike[]) => {
      for (const entry of entries) {
        if (entry.name === 'first-contentful-paint') {
          postPreviewMetric('fcp', entry.startTime);
          return;
        }
      }
    };
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    reportPaintEntries(performance.getEntriesByType('paint'));
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    let observer: PerformanceObserver | null = null;
    try {
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      observer = new PerformanceObserver((list) => {
        reportPaintEntries(list.getEntries());
      });
      observer.observe({ type: 'paint', buffered: true });
    } catch {
      observer = null;
    }
    return () => observer?.disconnect();
  }, [postPreviewMetric, previewMetricId]);

  useEffect(() => clearTtiTimer, [clearTtiTimer]);

  return {
    clearTtiTimer,
    scheduleTtiMetric,
    scheduleFmpMetric,
    scheduleFcpFallbackMetric,
    scheduleRenderMetric,
  };
}
