// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createAgentStepLogger } from './agent-step-logger.js';
import { buildOpenAIRunOptions, pickProviderConfig } from './provider.js';
import type { ChatOptions } from './types.js';
import { initializeArkImageGenerationRunScope } from '../../agent/common/ark-image-generation-tool.js';
import { createSearchRunScope } from '../../agent/common/doubao-search-tool.js';

export function pickAgentCapabilityConfig(opts: ChatOptions) {
  return {
    ...pickProviderConfig(opts),
    enableWebSearch: opts.enableWebSearch,
    enableImageGeneration: opts.enableImageGeneration,
  };
}

/** Each invocation owns its tool budgets, even when the Agent is cached. */
export function buildCapabilityRunOptions(
  opts: ChatOptions,
  abortSignal?: AbortSignal,
  agent = 'genui',
) {
  const scope = createSearchRunScope();
  initializeArkImageGenerationRunScope(scope);
  return {
    ...buildOpenAIRunOptions(opts, abortSignal),
    ...scope,
    ...createAgentStepLogger(opts, agent),
  };
}
