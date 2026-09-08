// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Agent } from '@mastra/core/agent';

import { buildOpenUiSystemPrompt } from '@lynx-js/genui-openui/openui-prompt';
import type {
  BuildOpenUiSystemPromptOptions,
} from '@lynx-js/genui-openui/openui-prompt';

import type { SearchRunScope } from '../common/doubao-search-tool.js';
import { createLLMProvider } from '../common/openai-provider.js';
import { createSearchCapability } from '../common/search-capability.js';
import type { SearchAgentOptions } from '../common/search-capability.js';

export interface OpenUIAgentOptions extends SearchAgentOptions {
  promptComponentNames?: readonly string[] | undefined;
  promptOptions?: BuildOpenUiSystemPromptOptions['promptOptions'];
  promptRoot?: string | undefined;
  systemAppendix?: string | undefined;
}

interface OpenUIAgentRunOptions {
  abortSignal?: AbortSignal | undefined;
  requestContext?: SearchRunScope['requestContext'] | undefined;
  resourceId?: string | undefined;
}

export interface OpenUIAgent {
  generate: (
    messages: unknown,
    options?: OpenUIAgentRunOptions,
  ) => unknown;
  stream: (
    messages: unknown,
    options?: OpenUIAgentRunOptions,
  ) => unknown;
}

export function createOpenUIAgent(opts: OpenUIAgentOptions = {}) {
  const { buildModel, model } = createLLMProvider(opts);
  const search = createSearchCapability(opts);
  const instructions = buildOpenUiSystemPrompt(
    {
      ...(opts.promptComponentNames === undefined
        ? {}
        : { componentNames: opts.promptComponentNames }),
      ...(opts.promptOptions === undefined
        ? {}
        : { promptOptions: opts.promptOptions }),
      ...(opts.promptRoot === undefined ? {} : { root: opts.promptRoot }),
      ...(opts.systemAppendix === undefined
        ? {}
        : { appendix: opts.systemAppendix }),
    },
  );

  const agent = new Agent({
    id: 'openui-agent',
    name: 'OpenUIAgent',
    instructions: [instructions, search.instructions].filter(Boolean).join(
      '\n\n',
    ),
    model: buildModel(model),
    tools: search.tools,
    defaultOptions: {
      maxSteps: 5,
      toolCallConcurrency: 3,
    },
  }) as unknown as OpenUIAgent;

  return { agent, model };
}
