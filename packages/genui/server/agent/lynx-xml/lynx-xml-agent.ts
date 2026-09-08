// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Agent } from '@mastra/core/agent';

import { LYNX_XML_HTML_FRAGMENT_TOOL_SYSTEM_PROMPT } from '@lynx-js/genui-lynx-xml';

import { createHtmlFragmentToMainThreadScriptTool } from './html-fragment-to-main-thread-script-tool.js';
import type { HtmlFragmentScriptRunScope } from './html-fragment-to-main-thread-script-tool.js';
import { createLLMProvider } from '../common/openai-provider.js';
import { createSearchCapability } from '../common/search-capability.js';
import type { SearchAgentOptions } from '../common/search-capability.js';

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
export function createLynxXmlAgent(opts: SearchAgentOptions = {}) {
  const { buildModel, model } = createLLMProvider(opts);
  const search = createSearchCapability(opts);
  const htmlFragmentToMainThreadScript =
    createHtmlFragmentToMainThreadScriptTool();
  const agent = new Agent({
    id: 'lynx-xml-agent',
    name: 'LynxXmlAgent',
    instructions: [
      LYNX_XML_HTML_FRAGMENT_TOOL_SYSTEM_PROMPT,
      search.instructions,
    ].filter(Boolean).join('\n\n'),
    model: buildModel(model),
    tools: {
      ...search.tools,
      html_fragment_to_main_thread_script: htmlFragmentToMainThreadScript,
    },
    defaultOptions: {
      maxSteps: 5,
      toolCallConcurrency: 1,
    },
  }) as unknown as LynxXmlAgent;

  return { agent, model };
}
