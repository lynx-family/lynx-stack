// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Agent } from '@mastra/core/agent';

import type { A2UICatalog } from './a2ui-catalog';
import { loadBasicCatalog } from './a2ui-catalog';
import { buildA2UISystemPrompt } from './a2ui-prompt';
import type { ArkImageGenerationRunScope } from './ark-image-generation-tool.js';
import { createArkImageGenerationTool } from './ark-image-generation-tool.js';
import { createLLMProvider } from './openai-provider';
import type { OpenAIProviderOptions } from './openai-provider';

const IMAGE_GENERATION_TOOL_INSTRUCTIONS = `## Image generation tool

Before returning an Image without a user-provided loadable URL, call the
generate_image tool with a detailed image prompt. Do not emit any text before
calling the tool. After it succeeds, copy its returned url exactly into
Image.url or the bound data-model field. Never invent an image URL or put an
image-generation prompt in Image.url. Generate only the minimum number of
distinct images needed and reuse a returned URL when appropriate. If the tool
fails, omit the Image and build the UI from other components.`;

export interface A2UIAgentOptions extends OpenAIProviderOptions {
  catalog?: A2UICatalog | undefined;
  systemAppendix?: string | undefined;
}

interface A2UIAgentRunOptions {
  requestContext: ArkImageGenerationRunScope['requestContext'];
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

export async function createA2UIAgent(opts: A2UIAgentOptions = {}) {
  const { buildModel, model } = createLLMProvider(opts);

  const catalog = opts.catalog ?? await loadBasicCatalog();
  const appendix = [opts.systemAppendix, IMAGE_GENERATION_TOOL_INSTRUCTIONS]
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
    },
    defaultOptions: {
      maxSteps: 5,
      toolCallConcurrency: 3,
    },
  }) as unknown as A2UIAgent;

  return { agent, model, catalog };
}
