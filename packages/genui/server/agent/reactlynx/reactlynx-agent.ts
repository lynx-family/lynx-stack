// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Agent } from '@mastra/core/agent';

import { REACTLYNX_SYSTEM_PROMPT } from '@lynx-js/genui-reactlynx';

import { GENUI_DESIGN_GUIDANCE } from '../../design/design-guidance.js';
import { createAgentCapabilities } from '../common/agent-capabilities.js';
import type { GenerationAgentOptions } from '../common/agent-capabilities.js';
import { createLLMProvider } from '../common/openai-provider.js';

export interface ReactLynxAgent {
  generate: (messages: unknown, options?: unknown) => unknown;
  stream: (messages: unknown, options?: unknown) => unknown;
}

export function createReactLynxAgent(opts: GenerationAgentOptions = {}) {
  const { buildModel, model } = createLLMProvider(opts);
  const capabilities = createAgentCapabilities(opts);
  return new Agent({
    id: 'reactlynx-agent',
    name: 'ReactLynxAgent',
    instructions: [
      REACTLYNX_SYSTEM_PROMPT,
      opts.enableDesignGuidance === false ? undefined : GENUI_DESIGN_GUIDANCE,
      capabilities.instructions,
    ].filter(Boolean).join('\n\n'),
    model: buildModel(model),
    tools: capabilities.tools,
    defaultOptions: { maxSteps: 5, toolCallConcurrency: 3 },
  }) as unknown as ReactLynxAgent;
}
