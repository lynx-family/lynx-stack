// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Agent } from '@mastra/core/agent';

import { buildOpenUiSystemPrompt } from '@lynx-js/genui-openui/openui-prompt';
import type {
  BuildOpenUiSystemPromptOptions,
} from '@lynx-js/genui-openui/openui-prompt';

import { createLLMProvider } from './openai-provider';
import type { OpenAIProviderOptions } from './openai-provider';

export interface OpenUIAgentOptions extends OpenAIProviderOptions {
  promptComponentNames?: readonly string[] | undefined;
  promptOptions?: BuildOpenUiSystemPromptOptions['promptOptions'];
  promptRoot?: string | undefined;
  systemAppendix?: string | undefined;
}

interface OpenUIAgentRunOptions {
  abortSignal?: AbortSignal | undefined;
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
    instructions,
    model: buildModel(model),
  }) as unknown as OpenUIAgent;

  return { agent, model };
}
