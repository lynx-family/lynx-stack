// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Agent } from '@mastra/core/agent';

import { buildLynxXmlSystemPrompt } from '@lynx-js/genui-lynx-xml/prompt';

import { createLLMProvider } from './openai-provider';
import type { OpenAIProviderOptions } from './openai-provider';

export interface LynxXmlAgentOptions extends OpenAIProviderOptions {
  systemAppendix?: string | undefined;
}

interface LynxXmlAgentRunOptions {
  resourceId?: string | undefined;
  maxRetries?: number | undefined;
  abortSignal?: AbortSignal | undefined;
}

export interface LynxXmlAgent {
  generate: (
    messages: unknown,
    options?: LynxXmlAgentRunOptions,
  ) => unknown;
}

export function createLynxXmlAgent(opts: LynxXmlAgentOptions = {}) {
  const { buildModel, model } = createLLMProvider(opts);
  const instructions = buildLynxXmlSystemPrompt(
    opts.systemAppendix === undefined
      ? {}
      : { appendix: opts.systemAppendix },
  );

  const agent = new Agent({
    id: 'lynx-xml-agent',
    name: 'LynxXmlAgent',
    instructions,
    model: buildModel(model),
  }) as unknown as LynxXmlAgent;

  return { agent, model };
}
