// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface GenerationMetrics {
  generationMs: number;
  firstReasoningTokenMs?: number;
  firstTextTokenMs?: number;
  /** Sum of completed model invocation durations; concurrent calls may overlap. */
  modelMs?: number;
  /** Sum of web and image search call durations. */
  searchMs?: number;
  /** Sum of image-generation call durations. */
  imageGenerationMs?: number;
}

function finiteDuration(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

/** Measure the generation pipeline once, before publishing its artifact. */
export function createGenerationTiming() {
  const startedAt = performance.now();
  const modelDurations = new Map<string, number>();
  const searchDurations = new Map<string, number>();
  const imageGenerationDurations = new Map<string, number>();
  let firstReasoningTokenMs: number | undefined;
  let firstTextTokenMs: number | undefined;
  let metrics: GenerationMetrics | undefined;

  const observe = (event: string, details: Record<string, unknown> = {}) => {
    if (metrics) return;
    if (
      event === 'agent.model.first_reasoning_token'
      && firstReasoningTokenMs === undefined
    ) {
      firstReasoningTokenMs = performance.now() - startedAt;
      return;
    }
    if (
      event === 'agent.model.first_text_token'
      && firstTextTokenMs === undefined
    ) {
      firstTextTokenMs = performance.now() - startedAt;
      return;
    }

    const durationMs = finiteDuration(details.durationMs);
    if (durationMs === undefined) return;
    const callId = typeof details.callId === 'string'
      ? details.callId
      : undefined;
    const toolName = typeof details.toolName === 'string'
      ? details.toolName
      : undefined;
    if (event === 'agent.tool.completed' && callId) {
      let durations: Map<string, number> | undefined;
      if (toolName === 'generate_image') {
        durations = imageGenerationDurations;
      } else if (toolName === 'web_search' || toolName === 'image_search') {
        durations = searchDurations;
      }
      if (durations) {
        durations.set(
          callId,
          Math.max(durations.get(callId) ?? 0, durationMs),
        );
      }
      return;
    }
    const invocationId = typeof details.invocationId === 'string'
      ? details.invocationId
      : undefined;
    if (
      invocationId
      && (event === 'agent.model.completed' || event === 'agent.model.error')
    ) {
      modelDurations.set(
        `agent:${invocationId}`,
        Math.max(modelDurations.get(`agent:${invocationId}`) ?? 0, durationMs),
      );
      return;
    }

    const requestIndex = finiteDuration(details.requestIndex);
    if (
      requestIndex !== undefined
      && (
        event === 'jev.model.completed'
        || event === 'jev.model.failed'
        || event === 'jev.model.cancelled'
      )
    ) {
      modelDurations.set(`jev:${requestIndex}`, durationMs);
    }
  };

  return {
    observe,
    finish() {
      if (metrics) return metrics;
      const modelMs = [...modelDurations.values()].reduce(
        (total, duration) => total + duration,
        0,
      );
      const searchMs = [...searchDurations.values()].reduce(
        (total, duration) => total + duration,
        0,
      );
      const imageGenerationMs = [...imageGenerationDurations.values()].reduce(
        (total, duration) => total + duration,
        0,
      );
      metrics = {
        generationMs: performance.now() - startedAt,
        ...(firstReasoningTokenMs === undefined
          ? {}
          : { firstReasoningTokenMs }),
        ...(firstTextTokenMs === undefined ? {} : { firstTextTokenMs }),
        ...(modelDurations.size === 0 ? {} : { modelMs }),
        ...(searchDurations.size === 0 ? {} : { searchMs }),
        ...(imageGenerationDurations.size === 0
          ? {}
          : { imageGenerationMs }),
      };
      return metrics;
    },
  };
}
