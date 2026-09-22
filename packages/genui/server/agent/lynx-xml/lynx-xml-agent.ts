// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Agent } from '@mastra/core/agent';
import type {
  LLMStepResult,
  MastraOnFinishCallbackArgs,
} from '@mastra/core/stream';

import { buildLynxXmlSystemPrompt } from '@lynx-js/genui-lynx-xml';
import type { LynxXmlStylePreset } from '@lynx-js/genui-lynx-xml';

import { GENUI_DESIGN_GUIDANCE } from '../../design/design-guidance.js';
import { createAgentCapabilities } from '../common/agent-capabilities.js';
import type { GenerationAgentOptions } from '../common/agent-capabilities.js';
import type { SearchRunScope } from '../common/doubao-search-tool.js';
import { createLLMProvider } from '../common/openai-provider.js';

export interface LynxXmlFragmentOptions {
  /** Assemble shared lifecycle and event scripts; defaults to false. */
  enableScriptReuse?: boolean | undefined;
  /** Generate an XML fragment for deterministic postprocessing; defaults to false. */
  enableHtmlFragment?: boolean | undefined;
  /** Optional utility CSS, independent of Template; disabled by default. */
  stylePreset?: LynxXmlStylePreset | false | undefined;
}

export interface LynxXmlAgentOptions
  extends GenerationAgentOptions, LynxXmlFragmentOptions
{}

interface LynxXmlAgentRunOptions {
  onStepFinish?: (step: LLMStepResult & { runId?: string }) => void;
  onFinish?: (result: MastraOnFinishCallbackArgs) => void;
  abortSignal?: AbortSignal | undefined;
  modelSettings?: {
    maxOutputTokens?: number | undefined;
  } | undefined;
  requestContext: SearchRunScope['requestContext'];
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

/** Create the provider-backed Lynx XML agent with the selected output contract. */
export function createLynxXmlAgent(opts: LynxXmlAgentOptions = {}) {
  const { buildModel, model } = createLLMProvider(opts);
  const capabilities = createAgentCapabilities(opts);
  const agent = new Agent({
    id: 'lynx-xml-agent',
    name: 'LynxXmlAgent',
    instructions: [
      buildLynxXmlSystemPrompt({
        enableScriptReuse: opts.enableScriptReuse === true,
        enableHtmlFragment: opts.enableHtmlFragment === true,
        stylePreset: opts.stylePreset ?? false,
      }),
      opts.enableDesignGuidance === false ? undefined : GENUI_DESIGN_GUIDANCE,
      capabilities.instructions,
    ].filter(Boolean).join('\n\n'),
    model: buildModel(model),
    tools: capabilities.tools,
    defaultOptions: {
      maxSteps: 5,
      toolCallConcurrency: 1,
    },
  }) as unknown as LynxXmlAgent;

  return { agent, model };
}
