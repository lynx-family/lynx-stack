// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Agent } from '@mastra/core/agent';

import { createAgentCapabilities } from './agent-capabilities.js';
import type { GenerationAgentOptions } from './agent-capabilities.js';
import type { SearchRunScope } from './doubao-search-tool.js';
import { createLLMProvider } from './openai-provider.js';
import { GENUI_DESIGN_GUIDANCE } from '../../design/design-guidance.js';

interface TextAgentRunOptions {
  abortSignal?: AbortSignal | undefined;
  requestContext?: SearchRunScope['requestContext'] | undefined;
  resourceId?: string | undefined;
}

export interface TextAgent {
  generate: (
    messages: unknown,
    options?: TextAgentRunOptions,
  ) => unknown;
  stream: (
    messages: unknown,
    options?: TextAgentRunOptions,
  ) => unknown;
}

export function createTextAgent(
  id: string,
  name: string,
  instructions: string,
  opts: GenerationAgentOptions,
) {
  const { buildModel, model } = createLLMProvider(opts);
  const capabilities = createAgentCapabilities(opts);
  const agent = new Agent({
    id,
    name,
    instructions: [
      instructions,
      opts.enableDesignGuidance === false ? undefined : GENUI_DESIGN_GUIDANCE,
      capabilities.instructions,
    ].filter(
      Boolean,
    )
      .join('\n\n'),
    model: buildModel(model),
    tools: capabilities.tools,
    defaultOptions: {
      maxSteps: 5,
      toolCallConcurrency: 3,
    },
  }) as unknown as TextAgent;

  return { agent, model };
}
