// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Agent } from '@mastra/core/agent';

import { HTML_SYSTEM_PROMPT } from '@lynx-js/genui-html';

import { GENUI_DESIGN_GUIDANCE } from '../../design/design-guidance.js';
import { createAgentCapabilities } from '../common/agent-capabilities.js';
import type { GenerationAgentOptions } from '../common/agent-capabilities.js';
import type { SearchRunScope } from '../common/doubao-search-tool.js';
import { createLLMProvider } from '../common/openai-provider.js';

interface HtmlAgentRunOptions {
  abortSignal?: AbortSignal | undefined;
  requestContext?: SearchRunScope['requestContext'] | undefined;
  resourceId?: string | undefined;
}

export interface HtmlAgent {
  generate: (
    messages: unknown,
    options?: HtmlAgentRunOptions,
  ) => unknown;
  stream: (
    messages: unknown,
    options?: HtmlAgentRunOptions,
  ) => unknown;
}

export function createHtmlAgent(opts: GenerationAgentOptions = {}) {
  const { buildModel, model } = createLLMProvider(opts);
  const capabilities = createAgentCapabilities(opts);
  const agent = new Agent({
    id: 'html-agent',
    name: 'HtmlAgent',
    instructions: [
      HTML_SYSTEM_PROMPT,
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
  }) as unknown as HtmlAgent;

  return { agent, model };
}
