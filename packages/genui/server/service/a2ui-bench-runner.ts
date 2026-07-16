// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { getA2UIAgentService } from './a2ui-agent';
import { resolveBenchCatalog } from './a2ui-bench-catalog';
import {
  BROWSER_BENCH_PREVIEW_ENABLED,
  runBenchPreview,
} from './a2ui-bench-preview';
import { getBenchJobStore } from './a2ui-bench-store';
import type {
  BenchCatalogLabel,
  BenchGroupRequest,
  BenchGroupSummary,
  BenchJobRequest,
  BenchReport,
  BenchReportSummary,
  BenchRunPhase,
  BenchRunResult,
  BenchScenarioRequest,
} from './a2ui-bench-types';
import type { ChatMessage } from './common/types';

interface BenchRunItem {
  group: BenchGroupRequest;
  scenario: BenchScenarioRequest;
  repeatIndex: number;
}

interface UsageRecord {
  promptTokens?: unknown;
  completionTokens?: unknown;
  totalTokens?: unknown;
  inputTokens?: unknown;
  outputTokens?: unknown;
  prompt_tokens?: unknown;
  completion_tokens?: unknown;
  total_tokens?: unknown;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pickNumber(record: UsageRecord, keys: (keyof UsageRecord)[]): number {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return 0;
}

function parseTotalTokens(usage: unknown): number {
  if (!usage || typeof usage !== 'object') return 0;
  const record = usage as UsageRecord;
  const promptTokens = pickNumber(record, [
    'promptTokens',
    'inputTokens',
    'prompt_tokens',
  ]);
  const completionTokens = pickNumber(record, [
    'completionTokens',
    'outputTokens',
    'completion_tokens',
  ]);
  const totalTokens = pickNumber(record, ['totalTokens', 'total_tokens']);
  return Math.round(totalTokens || promptTokens + completionTokens);
}

function buildRunMatrix(request: BenchJobRequest): BenchRunItem[] {
  const enabledGroups = request.groups.filter((group) => group.enabled);
  return enabledGroups.flatMap((group) =>
    request.scenarios.flatMap((scenario) =>
      Array.from({ length: request.settings.repeats }, (_, index) => ({
        group,
        scenario,
        repeatIndex: index + 1,
      }))
    )
  );
}

function buildBenchPrompt(
  group: BenchGroupRequest,
  scenario: BenchScenarioRequest,
): string {
  return [
    'Generate one A2UI v0.9 UI for the following benchmark scenario.',
    '',
    `Scenario name: ${scenario.name}`,
    `Scenario type: ${scenario.type}`,
    scenario.action ? `Required action: ${scenario.action}` : undefined,
    '',
    'User request:',
    scenario.prompt,
    '',
    'Benchmark constraints:',
    '- Return only valid A2UI protocol messages.',
    '- Use the selected catalog only.',
    '- Do not include benchmark metadata in the UI.',
    '',
    group.extraInstruction
      ? `Group instruction:\n${group.extraInstruction}`
      : undefined,
  ]
    .filter((line): line is string => line !== undefined)
    .join('\n');
}

function pickRunModel(
  request: BenchJobRequest,
  group: BenchGroupRequest,
): string | undefined {
  if (group.variable === 'model' || group.variable === 'custom') {
    return group.model ?? request.provider.model;
  }
  return request.provider.model;
}

function pickRunCatalog(group: BenchGroupRequest): BenchCatalogLabel {
  return group.catalog ?? 'Full Catalog';
}

function emitRunPhase(
  jobId: string,
  item: BenchRunItem,
  phase: BenchRunPhase,
): void {
  const store = getBenchJobStore();
  const job = store.updateProgress(jobId, {
    current: {
      groupId: item.group.id,
      scenarioId: item.scenario.id,
      repeatIndex: item.repeatIndex,
      phase,
    },
  });
  if (!job) return;
  store.emit(jobId, 'run-phase', {
    groupId: item.group.id,
    scenarioId: item.scenario.id,
    repeatIndex: item.repeatIndex,
    phase,
    progress: job.progress,
  });
}

async function runOne(
  jobId: string,
  request: BenchJobRequest,
  item: BenchRunItem,
): Promise<BenchRunResult> {
  const store = getBenchJobStore();
  const runId = `${item.group.id}-${item.scenario.id}-${item.repeatIndex}`;
  const model = pickRunModel(request, item.group);
  const catalogLabel = pickRunCatalog(item.group);
  const catalog = resolveBenchCatalog(catalogLabel);

  store.emit(jobId, 'run-start', {
    runId,
    groupId: item.group.id,
    scenarioId: item.scenario.id,
    repeatIndex: item.repeatIndex,
    progress: store.getJob(jobId)?.progress,
  });

  const messages: ChatMessage[] = [
    { role: 'user', content: buildBenchPrompt(item.group, item.scenario) },
  ];
  const startedAt = performance.now();
  emitRunPhase(jobId, item, 'agent');

  try {
    const result = await getA2UIAgentService().generateValidated(
      messages,
      {
        resourceId: `bench:${jobId}:${runId}`,
        apiKey: request.provider.apiKey,
        baseURL: request.provider.baseURL,
        model,
        api: request.provider.api,
        catalog,
        maxRepairAttempts: request.settings.maxRepairAttempts,
      },
    );
    emitRunPhase(jobId, item, 'validate');
    const agentMs = performance.now() - startedAt;
    const outputChars = result.text.length;
    const preview = result.ok
      ? await runBenchPreviewForItem(jobId, request, item, result.messages)
      : {
        errors: [],
        fmpMs: 0,
        judgeScore: 0,
        renderMs: 0,
        ttiMs: 0,
      };
    return {
      id: runId,
      groupId: item.group.id,
      groupName: item.group.name,
      role: item.group.role,
      scenarioId: item.scenario.id,
      scenarioName: item.scenario.name,
      repeatIndex: item.repeatIndex,
      status: result.ok ? 'complete' : 'failed',
      ok: result.ok,
      model: model ?? process.env.OPENAI_MODEL ?? 'server default',
      catalog: catalogLabel,
      tokens: parseTotalTokens(result.usage),
      agentMs: Math.round(agentMs),
      fmpMs: preview.fmpMs,
      ttiMs: preview.ttiMs,
      renderMs: preview.renderMs,
      attempts: result.attempts,
      judgeScore: preview.judgeScore,
      messageCount: result.messages.length,
      outputChars,
      errors: [...result.errors, ...preview.errors],
      finishReason: result.finishReason,
      usage: result.usage,
      messages: result.messages,
      ...(preview.screenshotDataUrl
        ? { screenshotDataUrl: preview.screenshotDataUrl }
        : {}),
      text: result.text,
    };
  } catch (error) {
    const agentMs = performance.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    return {
      id: runId,
      groupId: item.group.id,
      groupName: item.group.name,
      role: item.group.role,
      scenarioId: item.scenario.id,
      scenarioName: item.scenario.name,
      repeatIndex: item.repeatIndex,
      status: 'failed',
      ok: false,
      model: model ?? process.env.OPENAI_MODEL ?? 'server default',
      catalog: catalogLabel,
      tokens: 0,
      agentMs: Math.round(agentMs),
      fmpMs: 0,
      ttiMs: 0,
      renderMs: 0,
      attempts: 0,
      judgeScore: 0,
      messageCount: 0,
      outputChars: 0,
      errors: [message],
      error: message,
    };
  }
}

async function runBenchPreviewForItem(
  jobId: string,
  request: BenchJobRequest,
  item: BenchRunItem,
  messages: BenchRunResult['messages'],
) {
  if (!messages || messages.length === 0) {
    return {
      errors: [],
      fmpMs: 0,
      judgeScore: 0,
      renderMs: 0,
      ttiMs: 0,
    };
  }

  if (
    !request.settings.renderMetricsEnabled && !request.settings.judgeEnabled
  ) {
    return {
      errors: [],
      fmpMs: 0,
      judgeScore: 0,
      renderMs: 0,
      ttiMs: 0,
    };
  }

  emitRunPhase(
    jobId,
    item,
    request.settings.renderMetricsEnabled ? 'render' : 'judge',
  );
  const preview = await runBenchPreview({
    messages,
    request,
    runId: `${item.group.id}-${item.scenario.id}-${item.repeatIndex}`,
    scenario: item.scenario,
  });
  if (request.settings.judgeEnabled) {
    emitRunPhase(jobId, item, 'judge');
  }
  return preview;
}

function summarizeGroup(
  group: BenchGroupRequest,
  results: BenchRunResult[],
): BenchGroupSummary {
  const groupResults = results.filter((item) => item.groupId === group.id);
  const successful = groupResults.filter((item) => item.ok);
  const base = successful.length > 0 ? successful : groupResults;
  const failedRuns = groupResults.filter((item) => !item.ok).length;
  return {
    groupId: group.id,
    groupName: group.name,
    role: group.role,
    runCount: groupResults.length,
    failedRuns,
    successRate: groupResults.length === 0
      ? 0
      : (groupResults.length - failedRuns) / groupResults.length,
    avgTokens: average(base.map((item) => item.tokens)),
    avgAgentMs: average(base.map((item) => item.agentMs)),
    avgFmpMs: average(base.map((item) => item.fmpMs)),
    avgTtiMs: average(base.map((item) => item.ttiMs)),
    avgRenderMs: average(base.map((item) => item.renderMs)),
    avgJudgeScore: average(base.map((item) => item.judgeScore)),
    avgAttempts: average(base.map((item) => item.attempts)),
  };
}

function summarizeReport(results: BenchRunResult[]): BenchReportSummary {
  const failedRuns = results.filter((item) => !item.ok).length;
  const successful = results.filter((item) => item.ok);
  const base = successful.length > 0 ? successful : results;
  return {
    totalRuns: results.length,
    completedRuns: results.length,
    failedRuns,
    successRate: results.length === 0
      ? 0
      : (results.length - failedRuns) / results.length,
    avgTokens: average(base.map((item) => item.tokens)),
    avgAgentMs: average(base.map((item) => item.agentMs)),
    avgAttempts: average(base.map((item) => item.attempts)),
  };
}

function buildReport(
  jobId: string,
  request: BenchJobRequest,
  results: BenchRunResult[],
  warnings: string[],
  status: BenchReport['status'],
): BenchReport {
  const enabledGroups = request.groups.filter((group) => group.enabled);
  const summary = summarizeReport(results);
  return {
    id: `bench-report-${jobId}`,
    jobId,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    status,
    settings: request.settings,
    env: {
      apiKeyConfigured: Boolean(
        request.provider.apiKey ?? process.env.OPENAI_API_KEY,
      ),
      baseURL: request.provider.baseURL
        ?? process.env.OPENAI_BASE_URL
        ?? 'https://api.openai.com/v1',
      model: request.provider.model
        ?? process.env.OPENAI_MODEL
        ?? 'server default',
      clientOverrideAccepted: Boolean(
        request.provider.apiKey
          ?? request.provider.baseURL
          ?? request.provider.model
          ?? request.provider.api,
      ),
    },
    capabilities: {
      agent: 'enabled',
      renderMetrics: request.settings.renderMetricsEnabled
          && BROWSER_BENCH_PREVIEW_ENABLED
        ? 'enabled'
        : 'disabled',
      judge: 'disabled',
    },
    warnings,
    groups: request.groups,
    scenarios: request.scenarios,
    results,
    summaries: enabledGroups.map((group) => summarizeGroup(group, results)),
    summary,
  };
}

export function startBenchJob(jobId: string): void {
  void runBenchJob(jobId);
}

async function runBenchJob(jobId: string): Promise<void> {
  const store = getBenchJobStore();
  const job = store.getJob(jobId);
  if (!job) return;
  const activeJob = job;
  const request = activeJob.request;
  const matrix = buildRunMatrix(request);

  store.updateStatus(jobId, 'running');

  let nextIndex = 0;
  const workerCount = Math.min(request.settings.parallelism, matrix.length);

  async function worker(): Promise<void> {
    while (!activeJob.abortController.signal.aborted) {
      const index = nextIndex++;
      const item = matrix[index];
      if (!item) return;

      const result = await runOne(jobId, request, item);
      const updated = store.addResult(jobId, result);
      if (!updated) return;
      const event = result.ok ? 'run-complete' : 'run-error';
      store.emit(jobId, event, {
        result,
        progress: updated.progress,
      });
    }
  }

  try {
    await Promise.all(
      Array.from({ length: workerCount }, () => worker()),
    );

    const latest = store.getJob(jobId);
    if (!latest) return;
    if (
      latest.abortController.signal.aborted || latest.status === 'cancelled'
    ) {
      const report = buildReport(
        jobId,
        request,
        latest.results,
        latest.warnings,
        'cancelled',
      );
      store.setReport(jobId, report);
      return;
    }

    latest.progress = {
      completedRuns: latest.results.length,
      totalRuns: matrix.length,
    };
    latest.status = 'complete';
    const report = buildReport(
      jobId,
      request,
      latest.results,
      latest.warnings,
      'complete',
    );
    store.setReport(jobId, report);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const latest = store.updateStatus(jobId, 'failed', message);
    if (!latest) return;
    const report = buildReport(
      jobId,
      request,
      latest.results,
      latest.warnings,
      'failed',
    );
    store.setReport(jobId, report);
  }
}
