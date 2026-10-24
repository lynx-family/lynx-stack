// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { DEFAULT_BENCH_SETTINGS } from './benchData.js';
import type { BenchReport } from './benchReportTypes.js';
import {
  getSelectedBenchReportId,
  readBenchHistory,
} from '../../storage/benchRepo.js';
import { BENCH_JOB_ID } from '../../utils/appRoute.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isVisibleModelName(name: unknown): name is string {
  return typeof name === 'string'
    && name.trim().length > 0 && name !== 'Model name unavailable'
    && !/\[redacted(?: credential)?\]/iu.test(name);
}

function modelName(value: unknown, fallback: unknown): string {
  if (isVisibleModelName(value)) return value;
  return isVisibleModelName(fallback) ? fallback : 'Model name unavailable';
}

function findSavedGroup(
  group: BenchReport['groups'][number],
  configGroups: Record<string, unknown>[],
): Record<string, unknown> | undefined {
  if (isVisibleModelName(group.id)) {
    return configGroups.find((item) => item.id === group.id);
  }
  // Older serialization replaced long generated ids with a redaction marker.
  // Recover only a unique match in this report's own saved plan, never by order.
  const matches = configGroups.filter((item) =>
    ['name', 'protocol', 'profile', 'role'].every((key) => {
      const value = group[key as keyof typeof group];
      return typeof value === 'string' && value.length > 0
        && item[key] === value;
    })
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function findResultGroup(
  result: BenchReport['results'][number],
  groups: BenchReport['groups'],
): BenchReport['groups'][number] | undefined {
  if (isVisibleModelName(result.groupId)) {
    return groups.find((group) => group.id === result.groupId);
  }
  const matches = groups.filter((group) =>
    group.name === result.groupName
    && group.protocol === result.protocol && group.role === result.role
  );
  return matches.length === 1 ? matches[0] : undefined;
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
      findSavedGroup(group, configGroups)?.model,
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
          findResultGroup(result, displayGroups)?.model,
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
export async function loadPublishedReport(jobId: string): Promise<BenchReport> {
  if (jobId && !BENCH_JOB_ID.test(jobId)) {
    throw new Error(
      'Only reports saved in this browser are supported. Open one from Bench history.',
    );
  }
  const selectedId = jobId ? null : await getSelectedBenchReportId();
  const entries = await readBenchHistory();
  const entry = entries.find((item) =>
    item.report
    && (jobId ? item.report.jobId === jobId : item.id === selectedId)
  );
  if (!entry) {
    throw new Error(
      'This report was not found in this browser’s Bench history.',
    );
  }
  return getHistoryReport(entry);
}
