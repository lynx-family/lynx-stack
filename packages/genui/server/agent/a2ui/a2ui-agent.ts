// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Agent } from '@mastra/core/agent';

import type { A2UICatalog } from './a2ui-catalog.js';
import { loadBasicCatalog } from './a2ui-catalog.js';
import { buildA2UISystemPrompt } from './a2ui-prompt.js';
import { createAgentCapabilities } from '../common/agent-capabilities.js';
import type { GenerationAgentOptions } from '../common/agent-capabilities.js';
import type { ArkImageGenerationRunScope } from '../common/ark-image-generation-tool.js';
import { getA2UIMastra } from '../common/mastra.js';
import { createLLMProvider } from '../common/openai-provider.js';

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

export interface A2UIAgentOptions extends GenerationAgentOptions {
  catalog?: A2UICatalog | undefined;
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
  ) => Promise<unknown>;
  stream: (
    messages: unknown,
    options?: A2UIAgentRunOptions,
  ) => Promise<unknown>;
  resumeGenerate: (
    resumeData: unknown,
    options: A2UIAgentRunOptions & { runId: string },
  ) => Promise<unknown>;
  resumeStream: (
    resumeData: unknown,
    options: A2UIAgentRunOptions & { runId: string },
  ) => Promise<unknown>;
}

export async function createA2UIAgent(opts: A2UIAgentOptions = {}) {
  const { buildModel, model } = createLLMProvider(opts);

  const catalog = opts.catalog ?? await loadBasicCatalog();
  const capabilities = createAgentCapabilities(
    opts,
    IMAGE_GENERATION_TOOL_INSTRUCTIONS,
  );
  const appendix = [
    opts.systemAppendix,
    capabilities.instructions,
  ]
    .filter((part): part is string => Boolean(part))
    .join('\n\n');
  const promptOptions = {
    catalog,
    appendix,
  };
  const instructions = buildA2UISystemPrompt(promptOptions);

  const agent = new Agent({
    id: 'a2ui-agent',
    name: 'A2UIAgent',
    instructions,
    mastra: getA2UIMastra(),
    model: buildModel(model),
    tools: capabilities.tools,
    defaultOptions: {
      maxSteps: 5,
      toolCallConcurrency: 3,
    },
  }) as unknown as A2UIAgent;

  return { agent, model, catalog };
}
