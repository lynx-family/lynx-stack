// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Agent } from '@mastra/core/agent';

import { BASIC_CATALOG } from './a2ui-catalog';
import type { A2UICatalog } from './a2ui-catalog';
import { buildA2UISystemPrompt } from './a2ui-prompt';
import { createLLMProvider } from './openai-provider';
import type { OpenAIProviderOptions } from './openai-provider';

export interface A2UIAgentOptions extends OpenAIProviderOptions {
  catalog?: A2UICatalog | undefined;
  systemAppendix?: string | undefined;
}

interface A2UIAgentRunOptions {
  threadId?: string | undefined;
  resourceId?: string | undefined;
}

export interface A2UIAgent {
  generate: (
    messages: unknown,
    options?: A2UIAgentRunOptions,
  ) => unknown;
  stream: (
    messages: unknown,
    options?: A2UIAgentRunOptions,
  ) => unknown;
}

export function createA2UIAgent(opts: A2UIAgentOptions = {}) {
  const { buildModel, model } = createLLMProvider(opts);

  const catalog = opts.catalog ?? BASIC_CATALOG;
  const promptOptions = {
    catalog,
    ...(opts.systemAppendix === undefined
      ? {}
      : { appendix: opts.systemAppendix }),
  };
  const instructions = buildA2UISystemPrompt(promptOptions);

  const agent = new Agent({
    id: 'a2ui-agent',
    name: 'A2UIAgent',
    instructions,
    model: buildModel(model),
  }) as unknown as A2UIAgent;

  return { agent, model, catalog };
}
