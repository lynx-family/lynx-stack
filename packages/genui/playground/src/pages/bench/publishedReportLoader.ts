// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { DEFAULT_BENCH_SETTINGS } from './benchData.js';
import type { BenchReport } from './benchReportTypes.js';
import { BENCH_JOB_ID } from '../../utils/appRoute.js';

export const BENCH_HISTORY_STORAGE_KEY = 'a2ui-bench-history';
export const BENCH_SELECTED_REPORT_STORAGE_KEY = 'a2ui-bench-selected-report';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isVisibleModelName(name: unknown): name is string {
  return typeof name === 'string'
    && name.trim().length > 0 && !/\[redacted(?: credential)?\]/iu.test(name);
}

function modelName(value: unknown, fallback: unknown): string {
  if (isVisibleModelName(value)) return value;
  return isVisibleModelName(fallback) ? fallback : 'Model name unavailable';
}

/** Fill missing display configuration from the same saved entry, never another run. */
export function getHistoryReport(entry: unknown): BenchReport {
  if (
    !isRecord(entry) || !isRecord(entry.report)
    || !Array.isArray(entry.report.results)
    || !Array.isArray(entry.report.summaries)
  ) {
    throw new Error('This history entry does not contain a Bench report.');
  }
  const report = entry.report;
  const config = isRecord(entry.config) ? entry.config : {};
  const env = isRecord(report.env)
    ? report.env
    : (isRecord(config.env)
      ? config.env
      : {});
  const configSettings = isRecord(config.settings) ? config.settings : {};
  const reportSettings = isRecord(report.settings) ? report.settings : {};
  const configGroups = Array.isArray(config.groups)
    ? config.groups.filter((item: unknown) => isRecord(item))
    : [];
  const groups = (Array.isArray(report.groups) && report.groups.length > 0
    ? report.groups
    : configGroups) as BenchReport['groups'];
  const displayGroups = groups.map((group) => ({
    ...group,
    model: modelName(
      group.model,
      configGroups.find((item) => item.id === group.id)?.model,
    ),
  }));
  return {
    ...report,
    id: typeof report.id === 'string'
      ? report.id
      : (typeof entry.id === 'string' ? entry.id : ''),
    createdAt: typeof report.createdAt === 'string'
      ? report.createdAt
      : (typeof entry.savedAt === 'string' ? entry.savedAt : ''),
    env: {
      model: modelName(
        env.model,
        isRecord(config.env) ? config.env.model : undefined,
      ),
      apiKeyConfigured: Boolean(env.apiKeyConfigured),
    },
    groups: displayGroups,
    results: (report.results as BenchReport['results']).map((result) =>
      result.model === undefined ? result : {
        ...result,
        model: modelName(
          result.model,
          displayGroups.find((group) => group.id === result.groupId)?.model,
        ),
      }
    ),
    scenarios: Array.isArray(report.scenarios) && report.scenarios.length > 0
      ? report.scenarios as BenchReport['scenarios']
      : (Array.isArray(config.scenarios)
        ? config.scenarios as BenchReport['scenarios']
        : []),
    settings: {
      ...DEFAULT_BENCH_SETTINGS,
      ...configSettings,
      ...reportSettings,
      collectLiveRenderMetrics: reportSettings.collectLiveRenderMetrics
        ?? reportSettings.renderMetricsEnabled
        ?? configSettings.collectLiveRenderMetrics
        ?? configSettings.renderMetricsEnabled
        ?? DEFAULT_BENCH_SETTINGS.collectLiveRenderMetrics,
    },
  } as BenchReport;
}

/** Legacy job links resolve directly from this browser's saved snapshot. */
export function loadPublishedReport(
  jobId: string,
  storage: Pick<Window['localStorage'], 'getItem'> = window.localStorage,
  tabStorage?: Pick<Window['sessionStorage'], 'getItem'>,
): BenchReport {
  if (jobId && !BENCH_JOB_ID.test(jobId)) {
    throw new Error(
      'Only reports saved in this browser are supported. Open one from Bench history.',
    );
  }
  const selectedId = jobId
    ? null
    : tabStorage?.getItem(BENCH_SELECTED_REPORT_STORAGE_KEY)
      ?? storage.getItem(BENCH_SELECTED_REPORT_STORAGE_KEY);
  const raw = storage.getItem(BENCH_HISTORY_STORAGE_KEY);
  if (!raw) {
    throw new Error(
      'This report was not found in this browser’s Bench history.',
    );
  }
  let entries: unknown;
  try {
    entries = JSON.parse(raw);
  } catch {
    throw new Error('Local Bench history could not be read.');
  }
  if (!Array.isArray(entries)) {
    throw new Error('Local Bench history could not be read.');
  }
  const entry: unknown = entries.find((item: unknown) =>
    isRecord(item) && isRecord(item.report)
    && (jobId ? item.report.jobId === jobId : item.id === selectedId)
  );
  if (!entry) {
    throw new Error(
      'This report was not found in this browser’s Bench history.',
    );
  }
  return getHistoryReport(entry);
}
