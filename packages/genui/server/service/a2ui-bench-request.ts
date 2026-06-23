// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  BenchCatalogLabel,
  BenchGroupRequest,
  BenchJobRequest,
  BenchRole,
  BenchScenarioRequest,
  BenchSettings,
  BenchVariable,
} from './a2ui-bench-types';

const MAX_GROUPS = 8;
const MAX_SCENARIOS = 20;
const MAX_REPEATS = 10;
const MAX_PARALLELISM = 4;
const MAX_IMAGE_CHARS = 14_000_000;
const MAX_PROMPT_CHARS = 4_000;
const MAX_TEXT_FIELD_CHARS = 1_000;

const CATALOG_LABELS = new Set<BenchCatalogLabel>([
  'Full Catalog',
  'Core Catalog',
  'Minimal Catalog',
]);

const ROLES = new Set<BenchRole>(['control', 'experiment']);
const VARIABLES = new Set<BenchVariable>([
  'model',
  'prompt',
  'catalog',
  'custom',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clampInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function readString(
  value: unknown,
  fallback: string,
  maxChars = MAX_TEXT_FIELD_CHARS,
): string {
  if (typeof value !== 'string') return fallback;
  return value.slice(0, maxChars);
}

function readOptionalString(
  value: unknown,
  maxChars = MAX_TEXT_FIELD_CHARS,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxChars) : undefined;
}

function readCatalog(value: unknown): BenchCatalogLabel {
  if (
    typeof value === 'string' && CATALOG_LABELS.has(value as BenchCatalogLabel)
  ) {
    return value as BenchCatalogLabel;
  }
  return 'Full Catalog';
}

function readRole(value: unknown): BenchRole {
  if (typeof value === 'string' && ROLES.has(value as BenchRole)) {
    return value as BenchRole;
  }
  return 'experiment';
}

function readVariable(value: unknown): BenchVariable {
  if (typeof value === 'string' && VARIABLES.has(value as BenchVariable)) {
    return value as BenchVariable;
  }
  return 'custom';
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.slice(0, MAX_TEXT_FIELD_CHARS))
    .filter(Boolean)
    .slice(0, 20);
  return items.length > 0 ? items : undefined;
}

function normalizeSettings(value: unknown): BenchSettings {
  const record = isRecord(value) ? value : {};
  const maxRepairAttempts = 'maxRepairAttempts' in record
    ? clampInt(record.maxRepairAttempts, 2, 0, 4)
    : (record.repairEnabled === false ? 0 : 2);
  return {
    repeats: clampInt(record.repeats, 3, 1, MAX_REPEATS),
    parallelism: clampInt(record.parallelism, 2, 1, MAX_PARALLELISM),
    maxRepairAttempts,
    repairEnabled: maxRepairAttempts > 0,
    judgeEnabled: record.judgeEnabled === true,
    renderMetricsEnabled: record.renderMetricsEnabled === true
      || record.collectLiveRenderMetrics === true,
    ...(record.timeoutMs === undefined
      ? {}
      : { timeoutMs: clampInt(record.timeoutMs, 120_000, 10_000, 600_000) }),
  };
}

function normalizeGroups(
  value: unknown,
  clientOverrideAccepted: boolean,
): BenchGroupRequest[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_GROUPS)
    .map((item, index): BenchGroupRequest | null => {
      if (!isRecord(item)) return null;
      const id = readString(item.id, `group-${index + 1}`, 120);
      const name = readString(item.name, `Group ${index + 1}`, 120);
      if (!id || !name) return null;
      const model = clientOverrideAccepted
        ? readOptionalString(item.model, 240)
        : undefined;
      return {
        id,
        role: readRole(item.role),
        name,
        variable: readVariable(item.variable),
        enabled: item.enabled !== false,
        ...(model ? { model } : {}),
        catalog: readCatalog(item.catalog),
        extraInstruction: readString(item.extraInstruction, '', 2_000),
      };
    })
    .filter((item): item is BenchGroupRequest => item !== null);
}

function normalizeScenarios(value: unknown): BenchScenarioRequest[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_SCENARIOS)
    .map((item, index): BenchScenarioRequest | null => {
      if (!isRecord(item)) return null;
      const id = readString(item.id, `scenario-${index + 1}`, 120);
      const name = readString(item.name, `Scenario ${index + 1}`, 160);
      const prompt = readString(item.prompt, '', MAX_PROMPT_CHARS).trim();
      if (!id || !name || !prompt) return null;
      const judgeTask = readOptionalString(item.judgeTask, MAX_PROMPT_CHARS);
      const judgeSteps = readStringArray(item.judgeSteps);
      const referenceImage = readOptionalString(
        item.referenceImage,
        MAX_IMAGE_CHARS,
      );
      return {
        id,
        name,
        prompt,
        type: readString(item.type, 'Custom', 120),
        complexity: clampInt(item.complexity, 1, 1, 3),
        action: readString(item.action, '', 160),
        ...(judgeTask ? { judgeTask } : {}),
        ...(judgeSteps ? { judgeSteps } : {}),
        ...(referenceImage ? { referenceImage } : {}),
      };
    })
    .filter((item): item is BenchScenarioRequest => item !== null);
}

function normalizePlayground(
  value: unknown,
): BenchJobRequest['playground'] {
  if (!isRecord(value)) return undefined;
  const baseUrl = readOptionalString(value.baseUrl, 500);
  return baseUrl ? { baseUrl } : undefined;
}

export function normalizeBenchJobRequest(
  value: unknown,
  options: { clientOverrideAccepted: boolean },
):
  | {
    ok: true;
    request: BenchJobRequest;
    totalRuns: number;
    warnings: string[];
  }
  | { ok: false; status: number; error: string }
{
  if (!isRecord(value)) {
    return { ok: false, status: 400, error: 'request body must be an object' };
  }

  const providerRecord = isRecord(value.provider) ? value.provider : {};
  const requestedProviderOverride = Boolean(
    readOptionalString(providerRecord.apiKey, 8_000)
      ?? readOptionalString(providerRecord.baseURL, 500)
      ?? readOptionalString(providerRecord.model, 240)
      ?? providerRecord.api,
  );
  const clientOverrideAccepted = options.clientOverrideAccepted;
  const api =
    providerRecord.api === 'chat' || providerRecord.api === 'responses'
      ? providerRecord.api
      : undefined;
  const provider: BenchJobRequest['provider'] = clientOverrideAccepted
    ? {
      ...(readOptionalString(providerRecord.apiKey, 8_000)
        ? { apiKey: readOptionalString(providerRecord.apiKey, 8_000) }
        : {}),
      ...(readOptionalString(providerRecord.baseURL, 500)
        ? { baseURL: readOptionalString(providerRecord.baseURL, 500) }
        : {}),
      ...(readOptionalString(providerRecord.model, 240)
        ? { model: readOptionalString(providerRecord.model, 240) }
        : {}),
      ...(api ? { api } : {}),
    }
    : {};

  const groups = normalizeGroups(value.groups, clientOverrideAccepted);
  const enabledGroups = groups.filter((group) => group.enabled);
  if (enabledGroups.length === 0) {
    return {
      ok: false,
      status: 400,
      error: 'at least one enabled group is required',
    };
  }

  const scenarios = normalizeScenarios(value.scenarios);
  if (scenarios.length === 0) {
    return {
      ok: false,
      status: 400,
      error: 'at least one scenario is required',
    };
  }

  const settings = normalizeSettings(value.settings);
  const totalRuns = enabledGroups.length * scenarios.length * settings.repeats;
  const warnings: string[] = [];
  if (!clientOverrideAccepted && requestedProviderOverride) {
    warnings.push(
      'Client provider overrides are disabled by server policy; using server environment provider settings.',
    );
  }

  const playground = normalizePlayground(value.playground);

  return {
    ok: true,
    request: {
      provider,
      ...(playground ? { playground } : {}),
      settings,
      groups,
      scenarios,
    },
    totalRuns,
    warnings,
  };
}
