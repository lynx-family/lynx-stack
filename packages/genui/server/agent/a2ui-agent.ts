// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Agent } from '@mastra/core/agent';

import type { A2UICatalog } from './a2ui-catalog';
import { loadBasicCatalog } from './a2ui-catalog';
import { buildA2UISystemPrompt } from './a2ui-prompt';
import type { ArkImageGenerationRunScope } from './ark-image-generation-tool.js';
import { createArkImageGenerationTool } from './ark-image-generation-tool.js';
import { createOptionalDoubaoSearchTool } from './doubao-search-tool.js';
import { createLLMProvider } from './openai-provider';
import type { OpenAIProviderOptions } from './openai-provider';

const IMAGE_GENERATION_TOOL_INSTRUCTIONS = `## Image generation tool

When an Image needs generation, return the usable UI before waiting for the
image. In the same assistant step that calls generate_image, emit one complete
A2UI JSON array containing createSurface (for a fresh response), the theme and
body, and a Loading component at the exact id where the Image will appear. The
array must be complete and independently renderable before the tool call
suspends the run.

Call generate_image with a detailed image prompt. When the asynchronous tool
result resumes the run, emit a new complete A2UI JSON array containing only the
smallest updateComponents and/or updateDataModel patch for the existing
surface. Replace the Loading component by reusing its exact id, and copy the
returned url exactly into Image.url or the bound data-model field. Do not emit
createSurface again in this resumed patch. Never invent an image URL or put an
image-generation prompt in Image.url. Generate only the minimum number of
distinct images needed and reuse a returned URL when appropriate. If the tool
fails, replace or remove the pending image presentation using other catalog
components; do not leave a permanent Loading component.`;

const WEB_SEARCH_TOOL_INSTRUCTIONS = `## Web search tool

Call web_search only when the user explicitly asks to search the web or when
the requested UI depends on current or externally verifiable information. Do
not search for ordinary static UI generation. Use focused queries and make no
more calls than necessary. Ground factual content in the returned results,
preserve source titles and URLs exactly, and use openUrl only with URLs returned
by the tool or supplied by the user. The tool returns text and source metadata,
not images. If search fails or returns no useful results, do not invent facts or
citations; present an honest unavailable or empty state instead.`;

export interface A2UIAgentOptions extends OpenAIProviderOptions {
  catalog?: A2UICatalog | undefined;
  enableWebSearch?: boolean | undefined;
  systemAppendix?: string | undefined;
}

interface A2UIAgentRunOptions {
  requestContext: ArkImageGenerationRunScope['requestContext'];
  resourceId?: string | undefined;
  runId?: string | undefined;
  toolCallId?: string | undefined;
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
  resumeGenerate: (
    resumeData: unknown,
    options: A2UIAgentRunOptions & { runId: string },
  ) => unknown;
  resumeStream: (
    resumeData: unknown,
    options: A2UIAgentRunOptions & { runId: string },
  ) => unknown;
}

export async function createA2UIAgent(opts: A2UIAgentOptions = {}) {
  const { buildModel, model } = createLLMProvider(opts);

  const catalog = opts.catalog ?? await loadBasicCatalog();
  const webSearch = createOptionalDoubaoSearchTool(opts.enableWebSearch);
  const appendix = [
    opts.systemAppendix,
    IMAGE_GENERATION_TOOL_INSTRUCTIONS,
    webSearch ? WEB_SEARCH_TOOL_INSTRUCTIONS : undefined,
  ]
    .filter((part): part is string => Boolean(part))
    .join('\n\n');
  const promptOptions = {
    catalog,
    appendix,
  };
  const instructions = buildA2UISystemPrompt(promptOptions);
  const generateImage = createArkImageGenerationTool();

  const agent = new Agent({
    id: 'a2ui-agent',
    name: 'A2UIAgent',
    instructions,
    model: buildModel(model),
    tools: {
      generate_image: generateImage,
      ...(webSearch ? { web_search: webSearch } : {}),
    },
    defaultOptions: {
      maxSteps: 5,
      toolCallConcurrency: 3,
    },
  }) as unknown as A2UIAgent;

  return { agent, model, catalog };
}
