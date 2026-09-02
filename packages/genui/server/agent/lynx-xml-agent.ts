// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Agent } from '@mastra/core/agent';

import { LYNX_XML_HTML_FRAGMENT_TOOL_SYSTEM_PROMPT } from '@lynx-js/genui-lynx-xml';

import { createHtmlFragmentToMainThreadScriptTool } from './html-fragment-to-main-thread-script-tool.js';
import type { HtmlFragmentScriptRunScope } from './html-fragment-to-main-thread-script-tool.js';
import { createLLMProvider } from './openai-provider.js';
import type { OpenAIProviderOptions } from './openai-provider.js';

interface LynxXmlAgentRunOptions {
  abortSignal?: AbortSignal | undefined;
  modelSettings?: {
    maxOutputTokens?: number | undefined;
  } | undefined;
  requestContext: HtmlFragmentScriptRunScope['requestContext'];
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

/** Create the provider-backed Lynx XML agent and its fragment conversion tool. */
export function createLynxXmlAgent(opts: OpenAIProviderOptions = {}) {
  const { buildModel, model } = createLLMProvider(opts);
  const htmlFragmentToMainThreadScript =
    createHtmlFragmentToMainThreadScriptTool();
  const agent = new Agent({
    id: 'lynx-xml-agent',
    name: 'LynxXmlAgent',
    instructions: LYNX_XML_HTML_FRAGMENT_TOOL_SYSTEM_PROMPT,
    model: buildModel(model),
    tools: {
      html_fragment_to_main_thread_script: htmlFragmentToMainThreadScript,
    },
    defaultOptions: {
      maxSteps: 3,
      toolCallConcurrency: 1,
    },
  }) as unknown as LynxXmlAgent;

  return { agent, model };
}
