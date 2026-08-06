// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { getA2UIAgentService } from './a2ui-agent';
import { resolveBenchCatalog } from './a2ui-bench-catalog';
import { probeBenchUiJudge } from './a2ui-bench-judge';
import type {
  BenchUiJudgeCapability,
  BenchUiJudgeResult,
} from './a2ui-bench-judge';
import { sanitizeBenchPublicValue } from './a2ui-bench-redaction';
// import { runBenchPreview } from './a2ui-bench-preview';
import { getBenchJobStore } from './a2ui-bench-store';
import type {
  BenchCatalogLabel,
  BenchGroupRequest,
  BenchGroupSummary,
  BenchJobRequest,
  BenchProfile,
  BenchProtocol,
  BenchReport,
  BenchReportSummary,
  BenchRunPhase,
  BenchRunResult,
  BenchScenarioRequest,
} from './a2ui-bench-types';
import type { ChatMessage } from './common/types';
import { createA2UIBenchAdapter } from './genui-bench/a2ui-adapter';
import type {
  ProtocolBenchAdapter,
  ProtocolBenchJudgePayload,
} from './genui-bench/protocol-adapter';
import type { ProtocolBenchScenario } from './genui-bench/types';
import {
  probeGenuiBenchUiJudge,
  runGenuiBenchUiJudge,
} from './genui-bench-judge';
import { createOpenUIBenchAdapter } from './openui-bench-adapter';
import {
  formatErrorsForModel,
  validateA2UIOutput,
} from '../agent/a2ui-validator';
import { resolveA2UIImageUrls } from '../agent/image-resolver';

interface BenchRunItem {
  group: BenchGroupRequest;
  scenario: BenchScenarioRequest;
  repeatIndex: number;
}

interface BenchRunSample {
  items: BenchRunItem[];
}

export interface BenchRunnerDependencies {
  adapters?: Partial<Record<BenchProtocol, ProtocolBenchAdapter>>;
}

type BenchJudgeCapabilities = Map<string, BenchUiJudgeCapability>;

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

function averagePlanned(values: number[], plannedRuns: number): number {
  if (plannedRuns === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / plannedRuns;
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

function protocolForGroup(group: BenchGroupRequest): BenchProtocol {
  return group.protocol ?? 'a2ui';
}

function profileForGroup(group: BenchGroupRequest): BenchProfile {
  return group.profile
    ?? (protocolForGroup(group) === 'openui' ? 'matched-core' : 'native');
}

function judgeCapabilityKey(group: BenchGroupRequest): string {
  return `${protocolForGroup(group)}:${profileForGroup(group)}`;
}

function buildRunSamples(request: BenchJobRequest): BenchRunSample[] {
  const enabledGroups = request.groups.filter((group) => group.enabled);
  const samples: BenchRunSample[] = [];
  let sampleOrdinal = 0;
  for (const scenario of request.scenarios) {
    for (
      let repeatIndex = 1;
      repeatIndex <= request.settings.repeats;
      repeatIndex++
    ) {
      const offset = enabledGroups.length === 0
        ? 0
        : sampleOrdinal % enabledGroups.length;
      const groups = [
        ...enabledGroups.slice(offset),
        ...enabledGroups.slice(0, offset),
      ];
      samples.push({
        items: groups.map((group) => ({ group, scenario, repeatIndex })),
      });
      sampleOrdinal++;
    }
  }
  return samples;
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
  return group.model ?? request.provider.model;
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

async function generateA2UINative(
  request: BenchJobRequest,
  item: BenchRunItem,
  runId: string,
  messages: ChatMessage[],
  catalog: ReturnType<typeof resolveBenchCatalog>,
  model: string | undefined,
  signal: AbortSignal,
): Promise<{
  attempts: number;
  errors: string[];
  finishReason?: unknown;
  messages: NonNullable<BenchRunResult['messages']>;
  ok: boolean;
  text: string;
  usage: unknown[];
  warnings: string[];
}> {
  const conversation = [...messages];
  const usage: unknown[] = [];
  const maxAttempts = Math.min(
    5,
    Math.max(1, request.settings.maxRepairAttempts + 1),
  );
  let lastText = '';
  let lastErrors: string[] = [];
  let lastFinishReason: unknown;
  let lastWarnings: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    signal.throwIfAborted();
    const generated = await getA2UIAgentService().generateRaw(
      conversation,
      {
        resourceId: `bench:${item.group.id}:${runId}:attempt-${attempt}`,
        apiKey: request.provider.apiKey,
        baseURL: request.provider.baseURL,
        model,
        api: request.provider.api,
        catalog,
        disableAgentCache: true,
        inheritReasoningEffort: false,
      },
      undefined,
      signal,
    );
    usage.push(generated.usage);
    lastText = generated.text;
    lastFinishReason = generated.finishReason;
    const validation = validateA2UIOutput(generated.text, catalog);
    lastErrors = validation.errors;
    lastWarnings = validation.warnings;
    if (validation.ok) {
      return {
        attempts: attempt,
        errors: [],
        finishReason: lastFinishReason,
        messages: await resolveA2UIImageUrls(validation.messages),
        ok: true,
        text: lastText,
        usage,
        warnings: lastWarnings,
      };
    }
    if (attempt < maxAttempts) {
      conversation.push({ role: 'assistant', content: generated.text });
      conversation.push({
        role: 'user',
        content: formatErrorsForModel(validation.errors),
      });
    }
  }

  return {
    attempts: maxAttempts,
    errors: lastErrors,
    finishReason: lastFinishReason,
    messages: [],
    ok: false,
    text: lastText,
    usage,
    warnings: lastWarnings,
  };
}

async function runA2UINativeOne(
  jobId: string,
  request: BenchJobRequest,
  item: BenchRunItem,
  judgeCapability: BenchUiJudgeCapability,
  signal: AbortSignal,
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
    const result = await generateA2UINative(
      request,
      item,
      runId,
      messages,
      catalog,
      model,
      signal,
    );
    emitRunPhase(jobId, item, 'validate');
    const agentMs = performance.now() - startedAt;
    const outputChars = result.text.length;
    const judgeSession = judgeCapability.session;
    const judge: BenchUiJudgeResult | {
      errors: [];
      score: 0;
      status: 'skipped';
      warnings: [];
    } = result.ok
        && request.settings.judgeEnabled
        && judgeSession
        && !signal.aborted
      ? await (async () => {
        emitRunPhase(jobId, item, 'judge');
        return await runGenuiBenchUiJudge({
          artifact: {
            protocol: 'a2ui',
            messages: result.messages ?? [],
          },
          scenario: item.scenario,
          session: judgeSession,
          signal,
          timeoutMs: request.settings.timeoutMs,
        });
      })()
      : { errors: [], score: 0, status: 'skipped', warnings: [] };
    const runErrors = [...result.errors, ...judge.errors];
    const runOk = result.ok && judge.status !== 'failed';
    /*
    const preview = result.ok
      ? await runBenchPreviewForItem(jobId, request, item, result.messages)
      : {
        errors: [],
        fmpMs: 0,
        judgeScore: 0,
        renderMs: 0,
        ttiMs: 0,
      };
    */
    return sanitizeBenchPublicValue({
      id: runId,
      groupId: item.group.id,
      groupName: item.group.name,
      role: item.group.role,
      protocol: 'a2ui',
      profile: 'native',
      scenarioId: item.scenario.id,
      scenarioName: item.scenario.name,
      repeatIndex: item.repeatIndex,
      status: runOk ? 'complete' : 'failed',
      ok: runOk,
      model: model ?? process.env.OPENAI_MODEL ?? 'server default',
      catalog: catalogLabel,
      tokens: result.usage.reduce<number>(
        (total, usage) => total + parseTotalTokens(usage),
        0,
      ),
      agentMs: Math.round(agentMs),
      // fmpMs: preview.fmpMs,
      fmpMs: 0,
      // ttiMs: preview.ttiMs,
      ttiMs: 0,
      // renderMs: preview.renderMs,
      renderMs: 0,
      attempts: result.attempts,
      ...(judge.status === 'complete' && 'dimensions' in judge
          && judge.dimensions
        ? { judgeDimensions: judge.dimensions }
        : {}),
      ...(judge.status === 'complete' && 'geqiScore' in judge
          && judge.geqiScore !== undefined
        ? { judgeGeqiScore: judge.geqiScore }
        : {}),
      judgeScore: judge.status === 'complete' ? judge.score : 0,
      judgeStatus: judge.status,
      ...(judge.status === 'complete' && 'reason' in judge && judge.reason
        ? { judgeReason: judge.reason }
        : {}),
      ...(judge.status === 'complete' && 'summary' in judge && judge.summary
        ? { judgeSummary: judge.summary }
        : {}),
      ...([...result.warnings, ...judge.warnings].length > 0
        ? { judgeWarnings: [...result.warnings, ...judge.warnings] }
        : {}),
      messageCount: result.messages.length,
      outputChars,
      errors: runErrors,
      ...(runOk
        ? {}
        : {
          error: runErrors.join('; ')
            || (judge.status === 'failed'
              ? 'UI Judge failed'
              : 'A2UI output failed validation'),
        }),
      finishReason: result.finishReason,
      usage: result.usage,
      messages: result.messages,
      ...('screenshotDataUrl' in judge && judge.screenshotDataUrl
        ? { screenshotDataUrl: judge.screenshotDataUrl }
        : {}),
      text: result.text,
    }, request.provider) as BenchRunResult;
  } catch (error) {
    const agentMs = performance.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    return sanitizeBenchPublicValue({
      id: runId,
      groupId: item.group.id,
      groupName: item.group.name,
      role: item.group.role,
      protocol: 'a2ui',
      profile: 'native',
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
      judgeStatus: 'skipped',
      messageCount: 0,
      outputChars: 0,
      errors: [message],
      error: message,
    }, request.provider) as BenchRunResult;
  }
}

function adapterScenarioFor(
  group: BenchGroupRequest,
  scenario: BenchScenarioRequest,
): ProtocolBenchScenario {
  const prompt = group.extraInstruction
    ? `${scenario.prompt}\n\nAdditional benchmark instruction:\n${group.extraInstruction}`
    : scenario.prompt;
  return {
    id: scenario.id,
    name: scenario.name,
    prompt,
    type: scenario.type,
    complexity: Math.max(
      1,
      Math.min(3, Math.round(scenario.complexity ?? 1)),
    ) as 1 | 2 | 3,
    ...(scenario.action ? { action: scenario.action } : {}),
    ...(scenario.judgeTask ? { judgeTask: scenario.judgeTask } : {}),
    ...(scenario.judgeSteps ? { judgeSteps: [...scenario.judgeSteps] } : {}),
  };
}

async function runProtocolAdapterOne(
  jobId: string,
  request: BenchJobRequest,
  item: BenchRunItem,
  judgeCapability: BenchUiJudgeCapability,
  adapter: ProtocolBenchAdapter | undefined,
  signal: AbortSignal,
): Promise<BenchRunResult> {
  const store = getBenchJobStore();
  const runId = `${item.group.id}-${item.scenario.id}-${item.repeatIndex}`;
  const protocol = protocolForGroup(item.group);
  const profile = profileForGroup(item.group);
  const model = pickRunModel(request, item.group);
  const catalogLabel = profile === 'matched-core'
    ? 'matched-core' as const
    : pickRunCatalog(item.group);

  store.emit(jobId, 'run-start', {
    runId,
    groupId: item.group.id,
    protocol,
    profile,
    scenarioId: item.scenario.id,
    repeatIndex: item.repeatIndex,
    progress: store.getJob(jobId)?.progress,
  });
  emitRunPhase(jobId, item, 'agent');
  const startedAt = performance.now();

  try {
    if (!adapter) {
      throw new Error(
        `No benchmark adapter is registered for ${protocol}/${profile}.`,
      );
    }
    const artifact = await adapter.generate({
      runId,
      pairId: `${item.scenario.id}-repeat-${item.repeatIndex}`,
      scenario: adapterScenarioFor(item.group, item.scenario),
      repeatIndex: item.repeatIndex,
      maxAttempts: Math.max(1, request.settings.maxRepairAttempts + 1),
      provider: {
        apiKey: request.provider.apiKey,
        baseURL: request.provider.baseURL,
        model,
        api: request.provider.api,
      },
    }, signal);
    emitRunPhase(jobId, item, 'validate');

    const judgePayload: ProtocolBenchJudgePayload | undefined =
      artifact.finalValid
        ? artifact.judgePayload
        : undefined;
    const judge: BenchUiJudgeResult | {
      errors: [];
      score: 0;
      status: 'skipped';
      warnings: [];
    } = request.settings.judgeEnabled
        && judgeCapability.session
        && judgePayload
        && !signal.aborted
      ? await (async () => {
        emitRunPhase(jobId, item, 'judge');
        return await runGenuiBenchUiJudge({
          artifact: judgePayload.kind === 'a2ui-messages'
            ? {
              protocol: 'a2ui',
              messages: judgePayload.messages as NonNullable<
                BenchRunResult['messages']
              >,
            }
            : { protocol: 'openui', rawText: judgePayload.rawText },
          scenario: item.scenario,
          session: judgeCapability.session!,
          signal,
          timeoutMs: request.settings.timeoutMs,
        });
      })()
      : { errors: [], score: 0, status: 'skipped', warnings: [] };
    const attempts = artifact.attempts;
    const tokens = attempts.reduce(
      (total, attempt) => total + attempt.totalTokens,
      0,
    );
    const messages = judgePayload?.kind === 'a2ui-messages'
      ? judgePayload.messages as NonNullable<BenchRunResult['messages']>
      : undefined;
    const judgeWarnings = [
      ...(artifact.warnings ?? []),
      ...judge.warnings,
    ];
    const agentMs = performance.now() - startedAt;
    const runErrors = [...artifact.finalErrors, ...judge.errors];
    const runOk = artifact.finalValid && judge.status !== 'failed';
    const result: BenchRunResult = {
      id: runId,
      groupId: item.group.id,
      groupName: item.group.name,
      role: item.group.role,
      protocol,
      profile,
      scenarioId: item.scenario.id,
      scenarioName: item.scenario.name,
      repeatIndex: item.repeatIndex,
      status: runOk ? 'complete' : 'failed',
      ok: runOk,
      model: model ?? process.env.OPENAI_MODEL ?? 'server default',
      catalog: catalogLabel,
      tokens,
      agentMs: Math.round(agentMs),
      fmpMs: 0,
      ttiMs: 0,
      renderMs: 0,
      attempts: attempts.length,
      ...(judge.status === 'complete' && 'dimensions' in judge
          && judge.dimensions
        ? { judgeDimensions: judge.dimensions }
        : {}),
      ...(judge.status === 'complete' && 'geqiScore' in judge
          && judge.geqiScore !== undefined
        ? { judgeGeqiScore: judge.geqiScore }
        : {}),
      judgeScore: judge.status === 'complete' ? judge.score : 0,
      judgeStatus: judge.status,
      ...(judge.status === 'complete' && 'reason' in judge && judge.reason
        ? { judgeReason: judge.reason }
        : {}),
      ...(judge.status === 'complete' && 'summary' in judge && judge.summary
        ? { judgeSummary: judge.summary }
        : {}),
      ...(judgeWarnings.length > 0 ? { judgeWarnings } : {}),
      messageCount: messages?.length ?? 0,
      outputChars: artifact.finalText?.length
        ?? attempts[attempts.length - 1]?.outputChars
        ?? 0,
      errors: runErrors,
      ...(runOk
        ? {}
        : {
          error: runErrors.join('; ')
            || (judge.status === 'failed'
              ? 'UI Judge failed'
              : `${protocol} output failed validation`),
        }),
      ...(attempts[attempts.length - 1]?.finishReason === undefined
        ? {}
        : {
          finishReason: attempts[attempts.length - 1]?.finishReason,
        }),
      usage: { totalTokens: tokens },
      ...(messages ? { messages } : {}),
      ...('screenshotDataUrl' in judge && judge.screenshotDataUrl
        ? { screenshotDataUrl: judge.screenshotDataUrl }
        : {}),
      ...(artifact.metadata
        ? { adapterMetadata: artifact.metadata }
        : {}),
      ...(artifact.finalText ? { text: artifact.finalText } : {}),
    };
    return sanitizeBenchPublicValue(
      result,
      request.provider,
    ) as BenchRunResult;
  } catch (error) {
    const agentMs = performance.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    return sanitizeBenchPublicValue({
      id: runId,
      groupId: item.group.id,
      groupName: item.group.name,
      role: item.group.role,
      protocol,
      profile,
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
      judgeStatus: 'skipped',
      messageCount: 0,
      outputChars: 0,
      errors: [message],
      error: message,
    }, request.provider) as BenchRunResult;
  }
}

async function runOne(
  jobId: string,
  request: BenchJobRequest,
  item: BenchRunItem,
  judgeCapabilities: BenchJudgeCapabilities,
  adapters: Partial<Record<BenchProtocol, ProtocolBenchAdapter>>,
  signal: AbortSignal,
): Promise<BenchRunResult> {
  const capability = judgeCapabilities.get(judgeCapabilityKey(item.group))
    ?? { enabled: false };
  if (
    protocolForGroup(item.group) === 'a2ui'
    && profileForGroup(item.group) === 'native'
  ) {
    return await runA2UINativeOne(
      jobId,
      request,
      item,
      capability,
      signal,
    );
  }
  return await runProtocolAdapterOne(
    jobId,
    request,
    item,
    capability,
    adapters[protocolForGroup(item.group)],
    signal,
  );
}

/*
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
*/

export function summarizeGroup(
  group: BenchGroupRequest,
  results: BenchRunResult[],
  plannedRuns = results.filter((item) => item.groupId === group.id).length,
): BenchGroupSummary {
  const groupResults = results.filter((item) => item.groupId === group.id);
  const successfulRuns = groupResults.filter((item) => item.ok).length;
  const judged = groupResults.filter((item) => item.judgeStatus === 'complete');
  const geqiJudged = judged.filter((item) =>
    typeof item.judgeGeqiScore === 'number'
  );
  const failedRuns = Math.max(0, plannedRuns - successfulRuns);
  return {
    groupId: group.id,
    groupName: group.name,
    role: group.role,
    protocol: protocolForGroup(group),
    profile: profileForGroup(group),
    plannedRuns,
    runCount: groupResults.length,
    failedRuns,
    successRate: plannedRuns === 0 ? 0 : successfulRuns / plannedRuns,
    avgTokens: averagePlanned(
      groupResults.map((item) => item.tokens),
      plannedRuns,
    ),
    avgAgentMs: averagePlanned(
      groupResults.map((item) => item.agentMs),
      plannedRuns,
    ),
    avgFmpMs: averagePlanned(
      groupResults.map((item) => item.fmpMs),
      plannedRuns,
    ),
    avgTtiMs: averagePlanned(
      groupResults.map((item) => item.ttiMs),
      plannedRuns,
    ),
    avgRenderMs: averagePlanned(
      groupResults.map((item) => item.renderMs),
      plannedRuns,
    ),
    avgJudgeScore: averagePlanned(
      judged.map((item) => item.judgeScore),
      plannedRuns,
    ),
    ...(geqiJudged.length > 0
      ? {
        avgJudgeGeqiScore: averagePlanned(
          geqiJudged.map((item) => item.judgeGeqiScore ?? 0),
          plannedRuns,
        ),
      }
      : {}),
    judgeRunCount: judged.length,
    avgAttempts: averagePlanned(
      groupResults.map((item) => item.attempts),
      plannedRuns,
    ),
  };
}

function summarizeReport(
  results: BenchRunResult[],
  plannedRuns: number,
): BenchReportSummary {
  const successfulRuns = results.filter((item) => item.ok).length;
  const failedRuns = Math.max(0, plannedRuns - successfulRuns);
  return {
    totalRuns: plannedRuns,
    completedRuns: results.length,
    failedRuns,
    successRate: plannedRuns === 0 ? 0 : successfulRuns / plannedRuns,
    avgTokens: averagePlanned(
      results.map((item) => item.tokens),
      plannedRuns,
    ),
    avgAgentMs: averagePlanned(
      results.map((item) => item.agentMs),
      plannedRuns,
    ),
    avgAttempts: averagePlanned(
      results.map((item) => item.attempts),
      plannedRuns,
    ),
  };
}

function buildReport(
  jobId: string,
  request: BenchJobRequest,
  results: BenchRunResult[],
  warnings: string[],
  status: BenchReport['status'],
  judgeCapabilities: BenchJudgeCapabilities,
): BenchReport {
  const enabledGroups = request.groups.filter((group) => group.enabled);
  const plannedRuns = enabledGroups.length
    * request.scenarios.length
    * request.settings.repeats;
  const plannedRunsPerGroup = request.scenarios.length
    * request.settings.repeats;
  const summary = summarizeReport(results, plannedRuns);
  const report: BenchReport = {
    id: `bench-report-${jobId}`,
    jobId,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    status,
    settings: request.settings,
    env: {
      model: request.provider.model
        ?? process.env.OPENAI_MODEL
        ?? 'server default',
    },
    capabilities: {
      agent: 'enabled',
      // renderMetrics: request.settings.renderMetricsEnabled
      //   ? 'enabled'
      //   : 'disabled',
      renderMetrics: 'disabled',
      judge: request.settings.judgeEnabled
          && enabledGroups.some((group) =>
            judgeCapabilities.get(judgeCapabilityKey(group))?.enabled === true
          )
        ? 'enabled'
        : 'disabled',
    },
    warnings,
    groups: request.groups.map((group) => ({
      ...group,
      protocol: protocolForGroup(group),
      profile: profileForGroup(group),
    })),
    scenarios: request.scenarios,
    results,
    summaries: enabledGroups.map((group) =>
      summarizeGroup(group, results, plannedRunsPerGroup)
    ),
    summary,
  };
  return sanitizeBenchPublicValue(report, request.provider) as BenchReport;
}

export function startBenchJob(jobId: string): void {
  void runBenchJob(jobId);
}

async function probeJudgeCapabilities(
  request: BenchJobRequest,
): Promise<BenchJudgeCapabilities> {
  const capabilities: BenchJudgeCapabilities = new Map();
  if (!request.settings.judgeEnabled) return capabilities;
  const groups = request.groups.filter((group) => group.enabled);
  const uniqueGroups = new Map(
    groups.map((group) => [judgeCapabilityKey(group), group]),
  );
  await Promise.all([...uniqueGroups.entries()].map(async ([key, group]) => {
    const capability = protocolForGroup(group) === 'a2ui'
        && profileForGroup(group) === 'native'
      ? await probeBenchUiJudge()
      : await probeGenuiBenchUiJudge(protocolForGroup(group));
    capabilities.set(key, capability);
  }));
  return capabilities;
}

function resolveProtocolAdapters(
  request: BenchJobRequest,
  overrides: BenchRunnerDependencies['adapters'],
): Partial<Record<BenchProtocol, ProtocolBenchAdapter>> {
  const protocols = new Set(
    request.groups.filter((group) =>
      group.enabled
      && !(
        protocolForGroup(group) === 'a2ui'
        && profileForGroup(group) === 'native'
      )
    ).map((group) => protocolForGroup(group)),
  );
  const adapters: Partial<Record<BenchProtocol, ProtocolBenchAdapter>> = {};
  for (const protocol of protocols) {
    adapters[protocol] = overrides?.[protocol]
      ?? (protocol === 'a2ui'
        ? createA2UIBenchAdapter()
        : createOpenUIBenchAdapter());
  }
  return adapters;
}

export async function runBenchJob(
  jobId: string,
  dependencies: BenchRunnerDependencies = {},
): Promise<void> {
  const store = getBenchJobStore();
  const job = store.getJob(jobId);
  if (!job) return;
  const activeJob = job;
  const request = activeJob.request;
  const samples = buildRunSamples(request);
  const totalRuns = samples.reduce(
    (total, sample) => total + sample.items.length,
    0,
  );
  let judgeCapabilities: BenchJudgeCapabilities = new Map();

  try {
    if (
      activeJob.abortController.signal.aborted
      || store.getJob(jobId)?.status === 'cancelled'
    ) {
      const report = buildReport(
        jobId,
        request,
        activeJob.results,
        activeJob.warnings,
        'cancelled',
        judgeCapabilities,
      );
      store.setReport(jobId, report);
      return;
    }

    store.updateStatus(jobId, 'running');
    judgeCapabilities = await probeJudgeCapabilities(request);
    const adapters = resolveProtocolAdapters(
      request,
      dependencies.adapters,
    );

    if (
      activeJob.abortController.signal.aborted
      || store.getJob(jobId)?.status === 'cancelled'
    ) {
      store.updateStatus(jobId, 'cancelled');
      const report = buildReport(
        jobId,
        request,
        activeJob.results,
        activeJob.warnings,
        'cancelled',
        judgeCapabilities,
      );
      store.setReport(jobId, report);
      return;
    }
    if (request.settings.judgeEnabled) {
      for (const [key, capability] of judgeCapabilities) {
        if (!capability.enabled && capability.reason) {
          activeJob.warnings.push(
            `UI Judge disabled for ${key}: ${capability.reason}`,
          );
        }
      }
    }

    let nextIndex = 0;
    const mixedProtocols = new Set(
      request.groups.filter((group) => group.enabled).map((group) =>
        protocolForGroup(group)
      ),
    ).size > 1;
    const workerCount = Math.min(
      mixedProtocols ? 1 : request.settings.parallelism,
      samples.length,
    );

    async function worker(): Promise<void> {
      while (!activeJob.abortController.signal.aborted) {
        const index = nextIndex++;
        const sample = samples[index];
        if (!sample) return;

        for (const item of sample.items) {
          if (activeJob.abortController.signal.aborted) return;
          const result = await runOne(
            jobId,
            request,
            item,
            judgeCapabilities,
            adapters,
            activeJob.abortController.signal,
          );
          if (activeJob.abortController.signal.aborted) return;
          const updated = store.addResult(jobId, result);
          if (!updated) return;
          const storedResult = updated.results[updated.results.length - 1]
            ?? result;
          const eventResult = { ...storedResult };
          delete eventResult.screenshotDataUrl;
          const event = storedResult.ok ? 'run-complete' : 'run-error';
          store.emit(jobId, event, {
            result: eventResult,
            progress: updated.progress,
          });
        }
      }
    }

    await Promise.all(
      Array.from({ length: workerCount }, () => worker()),
    );

    const latest = store.getJob(jobId);
    if (!latest) return;
    if (
      latest.abortController.signal.aborted || latest.status === 'cancelled'
    ) {
      store.updateStatus(jobId, 'cancelled');
      const report = buildReport(
        jobId,
        request,
        latest.results,
        latest.warnings,
        'cancelled',
        judgeCapabilities,
      );
      store.setReport(jobId, report);
      return;
    }

    latest.progress = {
      completedRuns: latest.results.length,
      totalRuns,
    };
    latest.status = 'complete';
    const report = buildReport(
      jobId,
      request,
      latest.results,
      latest.warnings,
      'complete',
      judgeCapabilities,
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
      judgeCapabilities,
    );
    store.setReport(jobId, report);
  }
}
