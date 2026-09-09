// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createImageGenerationCapability } from './image-generation-capability.js';
import type { ImageGenerationCapabilityOptions } from './image-generation-capability.js';
import { createSearchCapability } from './search-capability.js';
import type { SearchAgentOptions } from './search-capability.js';

export interface GenerationAgentOptions
  extends SearchAgentOptions, ImageGenerationCapabilityOptions
{}

export function createAgentCapabilities(
  opts: GenerationAgentOptions = {},
  imageContinuationInstructions?: string,
) {
  const imageGeneration = createImageGenerationCapability(
    opts,
    imageContinuationInstructions,
  );
  const search = createSearchCapability(opts, imageGeneration.enabled);
  return {
    tools: { ...search.tools, ...imageGeneration.tools },
    instructions: [search.instructions, imageGeneration.instructions].filter(
      Boolean,
    ).join('\n\n'),
  };
}
