// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Agent } from '@mastra/core/agent';

import { LYNX_XML_SYSTEM_PROMPT } from '@lynx-js/genui-lynx-xml';

import { createLLMProvider } from './openai-provider.js';
import type { OpenAIProviderOptions } from './openai-provider.js';

export {
  LYNX_XML_SYSTEM_PROMPT as LYNX_XML_AGENT_INSTRUCTIONS,
} from '@lynx-js/genui-lynx-xml';

interface LynxXmlAgentRunOptions {
  abortSignal?: AbortSignal | undefined;
  resourceId?: string | undefined;
}

export interface LynxXmlAgent {
  generate: (
    messages: unknown,
    options?: LynxXmlAgentRunOptions,
  ) => unknown;
  stream: (
    messages: unknown,
    options?: LynxXmlAgentRunOptions,
  ) => unknown;
}

export function createLynxXmlAgent(opts: OpenAIProviderOptions = {}) {
  const { buildModel, model } = createLLMProvider(opts);
  const agent = new Agent({
    id: 'lynx-xml-agent',
    name: 'LynxXmlAgent',
    instructions: LYNX_XML_SYSTEM_PROMPT,
    model: buildModel(model),
  }) as unknown as LynxXmlAgent;

  return { agent, model };
}
