// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { MAX_BENCH_GROUPS } from './benchData.js';
import type { BenchGroup, BenchScenario, BenchSettings } from './benchData.js';
import { normalizeBenchUiJudgeServerUrl } from './benchUiJudgeServerUrl.js';
import { decodeBase64Url, encodeBase64Url } from '../../utils/base64url.js';

const MAX_PLAN_LENGTH = 64_000;
const INVALID_PLAN = 'This Bench parameter link is invalid or unsupported.';

export interface BenchSharedPlan {
  version: 1;
  title: string;
  groups: BenchGroup[];
  scenarios: BenchScenario[];
  settings: BenchSettings;
  uiJudgeServerUrl?: string;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(INVALID_PLAN);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown): string {
  if (typeof value !== 'string') throw new Error(INVALID_PLAN);
  return value;
}

function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error(INVALID_PLAN);
  return value;
}

function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(INVALID_PLAN);
  }
  return value;
}

function option<T extends string>(value: unknown, options: readonly T[]): T {
  if (!options.includes(value as T)) throw new Error(INVALID_PLAN);
  return value as T;
}

function items<T extends { id: string }>(
  value: unknown,
  max: number,
  read: (value: unknown) => T,
): T[] {
  if (!Array.isArray(value) || value.length > max) {
    throw new Error(INVALID_PLAN);
  }
  const result = value.map(item => read(item));
  if (
    result.some(item => !item.id.trim())
    || new Set(result.map(item => item.id)).size !== result.length
  ) throw new Error(INVALID_PLAN);
  return result;
}

// Select every field explicitly so reports, credentials, and provider endpoints
// cannot enter a link, including when sharing a completed history entry.
function readPlan(value: unknown): BenchSharedPlan {
  const plan = record(value);
  if (plan.version !== 1) throw new Error(INVALID_PLAN);
  const settings = record(plan.settings);
  const repeats = number(settings.repeats);
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 10) {
    throw new Error(INVALID_PLAN);
  }
  const uiJudgeServerUrl = plan.uiJudgeServerUrl === undefined
    ? undefined
    : normalizeBenchUiJudgeServerUrl(string(plan.uiJudgeServerUrl));
  if (uiJudgeServerUrl === null) {
    throw new Error(
      'UI_JUDGE_SERVER_URL must be an HTTP(S) URL without credentials.',
    );
  }
  return {
    version: 1,
    title: string(plan.title),
    ...(uiJudgeServerUrl === undefined ? {} : { uiJudgeServerUrl }),
    groups: items(plan.groups, MAX_BENCH_GROUPS, value => {
      const group = record(value);
      return {
        id: string(group.id),
        name: string(group.name),
        model: string(group.model),
        protocol: option(group.protocol, [
          'a2ui',
          'openui',
          'lynx-xml',
          'html',
        ]),
        profile: option(group.profile, ['native', 'matched-core']),
        role: option(group.role, ['control', 'experiment']),
        variable: option(group.variable, [
          'catalog',
          'custom',
          'model',
          'prompt',
          'protocol',
        ]),
        catalog: string(group.catalog),
        enabled: boolean(group.enabled),
        extraInstruction: string(group.extraInstruction),
        ...(group.enableDesignGuidance === undefined ? {} : {
          enableDesignGuidance: boolean(group.enableDesignGuidance),
        }),
        ...(group.enableHtmlFragment === undefined ? {} : {
          enableHtmlFragment: boolean(group.enableHtmlFragment),
        }),
      };
    }),
    scenarios: items(plan.scenarios, 20, value => {
      const scenario = record(value);
      return {
        id: string(scenario.id),
        name: string(scenario.name),
        prompt: string(scenario.prompt),
        type: string(scenario.type),
        complexity: number(scenario.complexity),
        action: string(scenario.action),
      };
    }),
    settings: {
      repeats,
      repairEnabled: boolean(settings.repairEnabled),
      judgeEnabled: boolean(settings.judgeEnabled),
      collectLiveRenderMetrics: boolean(settings.collectLiveRenderMetrics),
      ...(settings.uiJudgeModel === undefined ? {} : {
        uiJudgeModel: string(settings.uiJudgeModel),
      }),
    },
  };
}

export function buildBenchPlanShareUrl(
  baseUrl: string,
  plan: Omit<BenchSharedPlan, 'version'>,
): string {
  const encoded = encodeBase64Url(
    JSON.stringify(readPlan({ ...plan, version: 1 })),
  );
  if (encoded.length > MAX_PLAN_LENGTH) {
    throw new Error(
      'These Bench parameters are too large for a share link. Shorten the prompts or use fewer scenarios.',
    );
  }
  const url = new URL(baseUrl);
  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = `/bench?plan=${encoded}`;
  return url.href;
}

export function readBenchPlanShare(encoded: string): BenchSharedPlan {
  if (
    !encoded || encoded.length > MAX_PLAN_LENGTH || !/^[\w-]+$/u.test(encoded)
  ) {
    throw new Error(INVALID_PLAN);
  }
  try {
    return readPlan(JSON.parse(decodeBase64Url(encoded)));
  } catch {
    throw new Error(INVALID_PLAN);
  }
}
