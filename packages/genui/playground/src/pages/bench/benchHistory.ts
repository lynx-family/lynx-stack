// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  DEFAULT_BENCH_SCENARIOS,
  DEFAULT_BENCH_SETTINGS,
  createDefaultBenchGroups,
} from './benchData.js';
import type {
  BenchGroup,
  BenchProfile,
  BenchProtocol,
  BenchRole,
  BenchScenario,
  BenchSettings,
  BenchVariable,
} from './benchData.js';
import { sanitizeBenchReportValue } from './benchReportSerialization.js';
import type { BenchReport } from './benchReportTypes.js';
import { CUSTOM_PROVIDER_MODEL } from '../chat/shared.js';

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface BenchHistoryConfig {
  env: {
    apiKeyConfigured: boolean;
    model: string;
  };
  settings: BenchSettings;
  groups: BenchGroup[];
  scenarios: BenchScenario[];
}

export interface BenchHistoryEntry {
  id: string;
  title: string;
  savedAt: string;
  report: BenchReport | null;
  config: BenchHistoryConfig;
}

type BenchReportSettingsPayload = Partial<BenchSettings> & {
  renderMetricsEnabled?: boolean;
};

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function isBenchRole(value: unknown): value is BenchRole {
  return value === 'control' || value === 'experiment';
}

function isBenchVariable(value: unknown): value is BenchVariable {
  return value === 'protocol'
    || value === 'model'
    || value === 'prompt'
    || value === 'catalog'
    || value === 'custom';
}

function isBenchProtocol(value: unknown): value is BenchProtocol {
  return value === 'a2ui' || value === 'openui' || value === 'lynx-xml'
    || value === 'html';
}

function isBenchProfile(value: unknown): value is BenchProfile {
  return value === 'native' || value === 'matched-core';
}

export function createBenchSettingsFromReport(
  report: Pick<BenchReport, 'settings'>,
): BenchSettings {
  const reportSettings = (report.settings ?? {}) as BenchReportSettingsPayload;
  return {
    repeats: readFiniteNumber(
      reportSettings.repeats,
      DEFAULT_BENCH_SETTINGS.repeats,
    ),
    repairEnabled: readBoolean(
      reportSettings.repairEnabled,
      DEFAULT_BENCH_SETTINGS.repairEnabled,
    ),
    judgeEnabled: readBoolean(
      reportSettings.judgeEnabled,
      DEFAULT_BENCH_SETTINGS.judgeEnabled,
    ),
    collectLiveRenderMetrics: readBoolean(
      reportSettings.collectLiveRenderMetrics,
      readBoolean(
        reportSettings.renderMetricsEnabled,
        DEFAULT_BENCH_SETTINGS.collectLiveRenderMetrics,
      ),
    ),
  };
}

export function createBenchGroupsFromReport(
  report: Pick<BenchReport, 'env' | 'groups'>,
): BenchGroup[] {
  const fallbackModel = report.env?.model ?? CUSTOM_PROVIDER_MODEL;
  const reportGroups = Array.isArray(report.groups) ? report.groups : [];
  const groups = reportGroups.map((group, index) => {
    const item = group as Partial<BenchGroup> & {
      enableHtmlFragmentTool?: boolean;
    };
    const protocol = isBenchProtocol(item.protocol)
      ? item.protocol
      : 'a2ui';
    return {
      id: item.id ?? createId(`history-group-${index + 1}`),
      role: isBenchRole(item.role) ? item.role : 'experiment',
      protocol,
      ...(protocol === 'lynx-xml'
        ? {
          enableHtmlFragment:
            (item.enableHtmlFragment ?? item.enableHtmlFragmentTool) === true,
        }
        : {}),
      profile: isBenchProfile(item.profile)
        ? item.profile
        : (protocol === 'openui' ? 'matched-core' : 'native'),
      name: item.name ?? `Group ${index + 1}`,
      variable: isBenchVariable(item.variable) ? item.variable : 'custom',
      model: item.model ?? fallbackModel,
      catalog: protocol === 'lynx-xml' || protocol === 'html'
        ? 'none'
        : item.catalog ?? 'Full Catalog',
      extraInstruction: item.extraInstruction ?? '',
      enabled: readBoolean(item.enabled, true),
    };
  });
  return groups.length > 0 ? groups : createDefaultBenchGroups(fallbackModel);
}

export function createBenchScenariosFromReport(
  report: Pick<BenchReport, 'scenarios'>,
): BenchScenario[] {
  const reportScenarios = Array.isArray(report.scenarios)
    ? report.scenarios
    : [];
  const scenarios = reportScenarios.map((scenario, index) => {
    const item = scenario as Partial<BenchScenario>;
    return {
      id: item.id ?? createId(`history-scenario-${index + 1}`),
      name: item.name ?? `Scenario ${index + 1}`,
      prompt: item.prompt ?? '',
      type: item.type ?? 'Custom',
      complexity: readFiniteNumber(item.complexity, 1),
      action: item.action ?? '',
    };
  });
  return scenarios.length > 0
    ? scenarios
    : DEFAULT_BENCH_SCENARIOS.map((scenario) => ({ ...scenario }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBenchHistoryEntry(value: unknown): value is BenchHistoryEntry {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string') return false;
  if (typeof value.title !== 'string') return false;
  if (typeof value.savedAt !== 'string') return false;
  if (value.report !== null && !isRecord(value.report)) return false;
  if (!isRecord(value.config)) return false;
  const reportIsValid = value.report === null
    || (Array.isArray(value.report.summaries)
      && Array.isArray(value.report.results));
  return reportIsValid
    && isRecord(value.config.env)
    && isRecord(value.config.settings)
    && Array.isArray(value.config.groups)
    && Array.isArray(value.config.scenarios);
}

export function migrateBenchHistoryEntries(
  value: unknown,
): BenchHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => isBenchHistoryEntry(entry)).map((entry) => {
    const safeReport = entry.report
      ? sanitizeBenchReportValue(entry.report) as BenchReport
      : null;
    const configReport = {
      ...(safeReport ?? {
        env: entry.config.env,
        results: [],
        summaries: [],
      }),
      groups: entry.config.groups,
      scenarios: entry.config.scenarios,
      settings: entry.config.settings,
    };
    return {
      ...entry,
      report: safeReport,
      config: {
        env: {
          apiKeyConfigured: Boolean(entry.config.env.apiKeyConfigured),
          model: entry.config.env.model ?? CUSTOM_PROVIDER_MODEL,
        },
        groups: createBenchGroupsFromReport(configReport),
        scenarios: createBenchScenariosFromReport(configReport),
        settings: createBenchSettingsFromReport(configReport),
      },
    };
  });
}

export function prepareBenchHistoryEntries(
  entries: BenchHistoryEntry[],
): BenchHistoryEntry[] {
  const persistableEntries = entries.map(
    (entry) => ({
      ...entry,
      report: sanitizeBenchReportValue(entry.report),
      config: {
        groups: entry.config.groups,
        scenarios: entry.config.scenarios,
        settings: entry.config.settings,
        env: {
          apiKeyConfigured: entry.config.env.apiKeyConfigured,
          model: entry.config.env.model,
        },
      },
    }),
  );
  return persistableEntries as BenchHistoryEntry[];
}

export function serializeBenchHistoryEntries(
  entries: BenchHistoryEntry[],
): string {
  return JSON.stringify(prepareBenchHistoryEntries(entries));
}
