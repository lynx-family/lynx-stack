// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Agent } from '@mastra/core/agent';

import { buildLynxXmlSystemPrompt } from '@lynx-js/genui-lynx-xml';

import { createHtmlFragmentToMainThreadScriptTool } from './html-fragment-to-main-thread-script-tool.js';
import { createLLMProvider } from './openai-provider.js';
import type { OpenAIProviderOptions } from './openai-provider.js';

const HTML_FRAGMENT_TOOL_INSTRUCTIONS = `Initial tree conversion tool:
- Draft the initial static Lynx element tree as one well-formed XML fragment, then call html_fragment_to_main_thread_script with that fragment.
- Use the returned JavaScript inside renderPage(). It assumes page and pageId already exist and appends every top-level fragment node to page.
- The tool handles element creation, literal text, classes, IDs, inline styles, datasets, attributes, and child order. Write state, event handlers, dynamic updates, lifecycle registration, and cleanup yourself.
- Do not put style, script, lynx, page, or raw-text elements in the fragment. Keep CSS in the artifact's style block and bind events in main-thread JavaScript.`;

export const LYNX_XML_AGENT_INSTRUCTIONS = buildLynxXmlSystemPrompt({
  appendix: HTML_FRAGMENT_TOOL_INSTRUCTIONS,
});

interface LynxXmlAgentRunOptions {
  abortSignal?: AbortSignal | undefined;
  modelSettings?: {
    maxOutputTokens?: number | undefined;
  } | undefined;
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
  const htmlFragmentToMainThreadScript =
    createHtmlFragmentToMainThreadScriptTool();
  const agent = new Agent({
    id: 'lynx-xml-agent',
    name: 'LynxXmlAgent',
    instructions: LYNX_XML_AGENT_INSTRUCTIONS,
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
