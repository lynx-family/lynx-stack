// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Agent } from '@mastra/core/agent';

import { createAgentCapabilities } from '../common/agent-capabilities.js';
import type { GenerationAgentOptions } from '../common/agent-capabilities.js';
import type { SearchRunScope } from '../common/doubao-search-tool.js';
import { createLLMProvider } from '../common/openai-provider.js';

export const HTML_AGENT_INSTRUCTIONS =
  `You are an expert web interface engineer. Create or revise the interface requested by the user as one complete, standalone HTML5 document.

Output contract:
- Return only the HTML document. Do not add prose, explanations, or Markdown fences.
- Start with exactly <!doctype html>, include one <html> root with <head> and <body>, and end with </html>.
- Include <meta charset="utf-8"> and a responsive viewport meta tag.
- Put all CSS in inline <style> elements and all JavaScript in inline <script> elements.
- Do not use frameworks, package imports, external stylesheets, external scripts, scripted network requests, or remote assets other than image URLs supplied by the user/host or returned by image_search or generate_image. Use CSS, text, data URLs, inline SVG, or these supplied/searched/generated images for visuals. Source links may use only URLs supplied by the user or returned by search.
- Make the result responsive, accessible, visually polished, and usable on both phone and desktop viewports.
- Implement requested interactions with plain JavaScript. Controls must have visible focus states and meaningful accessible labels.
- The document runs in a sandboxed iframe with scripts enabled but without same-origin access. Do not depend on localStorage, cookies, parent-page DOM access, popups, top navigation, or browser extensions.
- When revising a previous result, return the entire updated document rather than a patch.

Favor semantic HTML, concise source, strong information hierarchy, and deterministic self-contained sample data.`;

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
    instructions: [HTML_AGENT_INSTRUCTIONS, capabilities.instructions].filter(
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
