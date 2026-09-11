// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  BenchTaskPool,
  MAX_BENCH_GROUPS,
  MAX_BENCH_JUDGE_CONCURRENCY,
  benchInFlightLimit,
} from './concurrency.js';
import type { BenchJudgeScheduling } from './concurrency.js';
import { resolveGenuiBenchUiJudge, runGenuiBenchUiJudge } from './judge.js';
import type { GenuiBenchJudgeArtifact } from './judge.js';
import { benchProgressSummary } from './progress.js';
import type {
  ProtocolBenchAdapter,
  ProtocolBenchJudgePayload,
} from './protocol-adapter.js';
import type { ProtocolBenchScenario } from './protocol-types.js';
import { sanitizeBenchPublicValue } from './redaction.js';
import { getBenchJobStore } from './store.js';
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
} from './types.js';
import { benchAttemptTokenCounts, readBenchTokenUsage } from './usage.js';
import { createA2UIImageSourcePolicy } from '../../../agent/a2ui/a2ui-image-source-policy.js';
import {
  formatErrorsForModel,
  validateA2UIOutput,
} from '../../../agent/a2ui/a2ui-validator.js';
import {
  createArkImageGenerationRunScope,
  generatedArkImageURLs,
} from '../../../agent/common/ark-image-generation-tool.js';
import { createScreenshotEvaluator } from '../../../agent/common/ui-judge-agent.js';
import type { ScreenshotEvaluator } from '../../../agent/common/ui-judge-agent.js';
import { getA2UIAgentService } from '../../a2ui/a2ui-agent.js';
import { createA2UIBenchAdapter } from '../../a2ui/a2ui-bench-adapter.js';
import { resolveBenchCatalog } from '../../a2ui/a2ui-bench-catalog.js';
import { resolveBenchUiJudge } from '../../a2ui/a2ui-bench-judge.js';
import type {
  BenchUiJudgeCapability,
  BenchUiJudgeResult,
} from '../../a2ui/a2ui-bench-judge.js';
// import { runBenchPreview } from '../../a2ui/a2ui-bench-preview.js';
import { createHtmlBenchAdapter } from '../../html/html-bench-adapter.js';
import { createLynxXmlBenchAdapter } from '../../lynx-xml/lynx-xml-bench-adapter.js';
import { createOpenUIBenchAdapter } from '../../openui/openui-bench-adapter.js';
import { defaultModelName } from '../model-config.js';
import type { ChatMessage } from '../types.js';

interface BenchRunItem {
  group: BenchGroupRequest;
  scenario: BenchScenarioRequest;
  repeatIndex: number;
}

interface GeneratedBenchRun {
  result: BenchRunResult;
  judgeArtifact?: GenuiBenchJudgeArtifact;
}

export interface BenchRunnerDependencies {
  adapters?: Partial<Record<BenchProtocol, ProtocolBenchAdapter>>;
}

type BenchJudgeCapabilities = Map<string, BenchUiJudgeCapability>;

// Shared by all jobs in this process. Admission waits stay outside Agent/Judge time.
const generationPool = new BenchTaskPool(MAX_BENCH_GROUPS);
const evaluationPool = new BenchTaskPool(MAX_BENCH_JUDGE_CONCURRENCY);

function averagePlanned(values: number[], plannedRuns: number): number {
  if (plannedRuns === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / plannedRuns;
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
  if (store.getJob(jobId)?.abortController.signal.aborted) return;
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
    runProgress: job.progress.runs?.find(run =>
      run.groupId === item.group.id && run.scenarioId === item.scenario.id
      && run.repeatIndex === item.repeatIndex
    ),
    progress: benchProgressSummary(job.progress),
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
  const imageGenerationScope = createArkImageGenerationRunScope();
  const isImageSourceAllowed = createA2UIImageSourcePolicy(
    [messages, catalog],
    () => generatedArkImageURLs(imageGenerationScope),
  );

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
        enableWebSearch: false,
        enableImageGeneration: false,
      },
      undefined,
      signal,
      imageGenerationScope,
    );
    usage.push(generated.usage);
    lastText = generated.text;
    lastFinishReason = generated.finishReason;
    const validation = validateA2UIOutput(generated.text, catalog, {
      isImageSourceAllowed,
    });
    lastErrors = validation.errors;
    lastWarnings = validation.warnings;
    if (validation.ok) {
      return {
        attempts: attempt,
        errors: [],
        finishReason: lastFinishReason,
        messages: validation.messages,
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
  signal: AbortSignal,
): Promise<GeneratedBenchRun> {
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
    progress: benchProgressSummary(store.getJob(jobId)!.progress),
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
    return {
      ...(result.ok
        ? {
          judgeArtifact: {
            protocol: 'a2ui' as const,
            messages: result.messages,
          },
        }
        : {}),
      result: sanitizeBenchPublicValue({
        id: runId,
        groupId: item.group.id,
        groupName: item.group.name,
        role: item.group.role,
        protocol: 'a2ui',
        profile: 'native',
        scenarioId: item.scenario.id,
        scenarioName: item.scenario.name,
        repeatIndex: item.repeatIndex,
        status: result.ok ? 'complete' : 'failed',
        ok: result.ok,
        model: model ?? defaultModelName() ?? 'server default',
        catalog: catalogLabel,
        tokens: result.usage.reduce<number>(
          (total, usage) => total + benchAttemptTokenCounts(usage).totalTokens,
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
        judgeScore: 0,
        judgeStatus: 'skipped',
        ...(result.warnings.length > 0
          ? { judgeWarnings: result.warnings }
          : {}),
        messageCount: result.messages.length,
        outputChars,
        errors: result.errors,
        ...(result.ok
          ? {}
          : {
            error: result.errors.join('; ') || 'A2UI output failed validation',
          }),
        finishReason: result.finishReason,
        usage: result.usage,
        messages: result.messages,
        text: result.text,
      }, request.provider) as BenchRunResult,
    };
  } catch (error) {
    const agentMs = performance.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    return {
      result: sanitizeBenchPublicValue({
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
        model: model ?? defaultModelName() ?? 'server default',
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
      }, request.provider) as BenchRunResult,
    };
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
  adapter: ProtocolBenchAdapter | undefined,
  signal: AbortSignal,
): Promise<GeneratedBenchRun> {
  const store = getBenchJobStore();
  const runId = `${item.group.id}-${item.scenario.id}-${item.repeatIndex}`;
  const protocol = protocolForGroup(item.group);
  const profile = profileForGroup(item.group);
  const model = pickRunModel(request, item.group);
  const catalogLabel = protocol === 'lynx-xml' || protocol === 'html'
    ? 'none' as const
    : (profile === 'matched-core'
      ? 'matched-core' as const
      : pickRunCatalog(item.group));

  store.emit(jobId, 'run-start', {
    runId,
    groupId: item.group.id,
    protocol,
    profile,
    scenarioId: item.scenario.id,
    repeatIndex: item.repeatIndex,
    progress: benchProgressSummary(store.getJob(jobId)!.progress),
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
      ...(protocol === 'lynx-xml'
        ? { enableHtmlFragment: item.group.enableHtmlFragment === true }
        : {}),
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
    const agentMs = performance.now() - startedAt;

    const judgePayload: ProtocolBenchJudgePayload | undefined =
      artifact.finalValid
        ? artifact.judgePayload
        : undefined;
    const attempts = artifact.attempts;
    const tokens = attempts.reduce(
      (total, attempt) => total + attempt.totalTokens,
      0,
    );
    const messages = judgePayload?.kind === 'a2ui-messages'
      ? judgePayload.messages as NonNullable<BenchRunResult['messages']>
      : undefined;
    const judgeWarnings = artifact.warnings ?? [];
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
      status: artifact.finalValid ? 'complete' : 'failed',
      ok: artifact.finalValid,
      model: model ?? defaultModelName() ?? 'server default',
      catalog: catalogLabel,
      tokens,
      agentMs: Math.round(agentMs),
      fmpMs: 0,
      ttiMs: 0,
      renderMs: 0,
      attempts: attempts.length,
      judgeScore: 0,
      judgeStatus: 'skipped',
      ...(judgeWarnings.length > 0 ? { judgeWarnings } : {}),
      messageCount: messages?.length ?? 0,
      outputChars: artifact.finalText?.length
        ?? attempts[attempts.length - 1]?.outputChars
        ?? 0,
      errors: artifact.finalErrors,
      ...(artifact.finalValid
        ? {}
        : {
          error: artifact.finalErrors.join('; ')
            || `${protocol} output failed validation`,
        }),
      ...(attempts[attempts.length - 1]?.finishReason === undefined
        ? {}
        : {
          finishReason: attempts[attempts.length - 1]?.finishReason,
        }),
      usage: {
        ...readBenchTokenUsage(attempts.map((attempt) => attempt.usage)),
        totalTokens: tokens,
      },
      ...(messages ? { messages } : {}),
      ...(artifact.metadata
        ? { adapterMetadata: artifact.metadata }
        : {}),
      ...(artifact.finalText ? { text: artifact.finalText } : {}),
    };
    return {
      result: sanitizeBenchPublicValue(
        result,
        request.provider,
      ) as BenchRunResult,
      ...(judgePayload
        ? {
          judgeArtifact: judgePayload.kind === 'a2ui-messages'
            ? {
              protocol: 'a2ui' as const,
              messages: judgePayload.messages as NonNullable<
                BenchRunResult['messages']
              >,
            }
            : {
              protocol: judgePayload.kind === 'lynx-xml-source'
                ? 'lynx-xml' as const
                : (judgePayload.kind === 'html-source'
                  ? 'html' as const
                  : 'openui' as const),
              rawText: judgePayload.rawText,
            },
        }
        : {}),
    };
  } catch (error) {
    const agentMs = performance.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    return {
      result: sanitizeBenchPublicValue({
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
        model: model ?? defaultModelName() ?? 'server default',
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
      }, request.provider) as BenchRunResult,
    };
  }
}

async function generateOne(
  jobId: string,
  request: BenchJobRequest,
  item: BenchRunItem,
  adapters: Partial<Record<BenchProtocol, ProtocolBenchAdapter>>,
  signal: AbortSignal,
): Promise<GeneratedBenchRun> {
  if (
    protocolForGroup(item.group) === 'a2ui'
    && profileForGroup(item.group) === 'native'
  ) {
    return await runA2UINativeOne(
      jobId,
      request,
      item,
      signal,
    );
  }
  return await runProtocolAdapterOne(
    jobId,
    request,
    item,
    adapters[protocolForGroup(item.group)],
    signal,
  );
}

async function finishRun(
  jobId: string,
  request: BenchJobRequest,
  item: BenchRunItem,
  generated: GeneratedBenchRun,
  judgeCapabilities: BenchJudgeCapabilities,
  scheduling: BenchJudgeScheduling,
  signal: AbortSignal,
  evaluate?: ScreenshotEvaluator,
): Promise<BenchRunResult> {
  const { result, judgeArtifact } = generated;
  const session = judgeCapabilities.get(judgeCapabilityKey(item.group))
    ?.session;
  if (
    !request.settings.judgeEnabled || !judgeArtifact || !session
    || signal.aborted
  ) {
    return result;
  }
  emitRunPhase(jobId, item, 'screenshot-queued');
  let judge: BenchUiJudgeResult;
  try {
    judge = await runGenuiBenchUiJudge(
      {
        model: request.settings.uiJudgeModel
          ?? pickRunModel(request, item.group),
        artifact: judgeArtifact,
        scenario: item.scenario,
        session,
        signal,
        timeoutMs: request.settings.timeoutMs,
        scheduling,
        onPhase: phase => emitRunPhase(jobId, item, phase),
        ...(evaluate ? { evaluate } : {}),
      },
      (capture, captureSignal) =>
        getBenchJobStore().requestScreenshot(jobId, capture, captureSignal),
    );
  } catch (error) {
    judge = {
      status: 'failed',
      score: 0,
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: [],
    };
  }
  const errors = [...result.errors, ...judge.errors];
  const warnings = [...(result.judgeWarnings ?? []), ...judge.warnings];
  const ok = result.ok && judge.status !== 'failed';
  return sanitizeBenchPublicValue({
    ...result,
    ok,
    status: ok ? 'complete' : 'failed',
    errors,
    ...(ok ? {} : { error: errors.join('; ') || 'UI Judge failed' }),
    judgeScore: judge.status === 'complete' ? judge.score : 0,
    judgeStatus: judge.status,
    ...(judge.status === 'complete'
      ? {
        ...(judge.dimensions ? { judgeDimensions: judge.dimensions } : {}),
        ...(judge.geqiScore === undefined
          ? {}
          : { judgeGeqiScore: judge.geqiScore }),
        ...(judge.reason ? { judgeReason: judge.reason } : {}),
        ...(judge.summary ? { judgeSummary: judge.summary } : {}),
      }
      : {}),
    ...(warnings.length > 0 ? { judgeWarnings: warnings } : {}),
    ...(judge.screenshotDataUrl
      ? { screenshotDataUrl: judge.screenshotDataUrl }
      : {}),
  }, request.provider) as BenchRunResult;
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
        ?? defaultModelName()
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

async function resolveJudgeCapabilities(
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
      ? await resolveBenchUiJudge()
      : await resolveGenuiBenchUiJudge(
        protocolForGroup(group),
      );
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
    const factories = {
      a2ui: createA2UIBenchAdapter,
      openui: createOpenUIBenchAdapter,
      'lynx-xml': createLynxXmlBenchAdapter,
      html: createHtmlBenchAdapter,
    };
    adapters[protocol] = overrides?.[protocol] ?? factories[protocol]();
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
  const groups = request.groups.filter((group) => group.enabled);
  const workerCount = groups.length;
  const totalRuns = workerCount * request.scenarios.length
    * request.settings.repeats;
  let judgeCapabilities: BenchJudgeCapabilities = new Map();

  try {
    if (request.groups.length > MAX_BENCH_GROUPS) {
      throw new Error(
        `Bench supports at most ${MAX_BENCH_GROUPS} comparison groups, including the baseline.`,
      );
    }
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
    judgeCapabilities = await resolveJudgeCapabilities(request);
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

    const scheduling: BenchJudgeScheduling = {
      evaluation: evaluationPool,
    };
    const judgeEvaluator = request.settings.judgeEnabled
        && request.settings.uiJudgeModel
      ? createScreenshotEvaluator(request.settings.uiJudgeModel).evaluate
      : undefined;
    // Reserve space before generation so announced browser tasks and pending
    // scores stay bounded even when the client drains its capture queue slowly.
    const inFlight = new BenchTaskPool(
      benchInFlightLimit(workerCount),
    );
    const pending = new Set<Promise<void>>();
    const failureController = new AbortController();
    const signal = AbortSignal.any([
      activeJob.abortController.signal,
      failureController.signal,
    ]);
    let failure: { error: unknown } | undefined;
    const fail = (error: unknown) => {
      if (signal.aborted) return;
      failure = { error };
      failureController.abort(error);
    };

    function publishResult(result: BenchRunResult): void {
      if (signal.aborted) return;
      const updated = store.addResult(jobId, result);
      if (!updated) return;
      const storedResult = updated.results[updated.results.length - 1]
        ?? result;
      const eventResult = { ...storedResult };
      delete eventResult.screenshotDataUrl;
      store.emit(jobId, storedResult.ok ? 'run-complete' : 'run-error', {
        result: eventResult,
        runProgress: updated.progress.runs?.find(run =>
          run.groupId === storedResult.groupId
          && run.scenarioId === storedResult.scenarioId
          && run.repeatIndex === storedResult.repeatIndex
        ),
        progress: benchProgressSummary(updated.progress),
      });
    }

    async function worker(group: BenchGroupRequest): Promise<void> {
      for (const scenario of request.scenarios) {
        for (
          let repeatIndex = 1;
          repeatIndex <= request.settings.repeats;
          repeatIndex++
        ) {
          if (signal.aborted) return;
          const item = { group, scenario, repeatIndex };
          const release = await inFlight.acquire(signal);
          let handedOff = false;
          try {
            if (signal.aborted) return;
            const generated = await generationPool.run(
              () => generateOne(jobId, request, item, adapters, signal),
              signal,
            );
            if (signal.aborted) return;
            const completion = finishRun(
              jobId,
              request,
              item,
              generated,
              judgeCapabilities,
              scheduling,
              signal,
              judgeEvaluator,
            ).then(publishResult).catch(fail).finally(() => {
              release();
              pending.delete(completion);
            });
            pending.add(completion);
            handedOff = true;
          } finally {
            if (!handedOff) release();
          }
        }
      }
    }

    await Promise.all(
      groups.map((group) => worker(group).catch(fail)),
    );
    // A terminal report releases the job slot and credentials, so all stages
    // must settle first, including cancellation and unexpected worker failures.
    await Promise.all(pending);
    if (failure) throw failure.error;

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
      ...latest.progress,
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
