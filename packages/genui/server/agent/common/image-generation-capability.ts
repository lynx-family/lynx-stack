// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  createArkImageGenerationTool,
  readArkImageGenerationConfig,
} from './ark-image-generation-tool.js';

export interface ImageGenerationCapabilityOptions {
  /** Disable image generation for controlled runs such as Bench. */
  enableImageGeneration?: boolean | undefined;
}

const IMAGE_GENERATION_INSTRUCTIONS = `## Server-side image generation

generate_image is an internal server tool, never a client-side action, OpenUI
Query/Mutation call, or MCP Apps routing target. Call it with a detailed prompt
when an original image is requested or a suitable existing image is unavailable.
Use image_search first when available, unless the user requests original artwork.
Generate only the minimum number of distinct images and reuse returned URLs.
At most four image-generation calls are allowed per request, including repairs.
Copy the returned url exactly into the protocol's image source or bound field.
Returned URLs are permitted image assets, including in HTML and Lynx XML.
Never invent image URLs or use image prompts as URLs. If generation fails, use
a text or other non-image presentation and preserve the protocol's output format.`;

/** A2UI supplies its continuation guidance; other protocols await the tool. */
export function createImageGenerationCapability(
  opts: ImageGenerationCapabilityOptions = {},
  continuationInstructions?: string,
) {
  const result = opts.enableImageGeneration === false
    ? undefined
    : readArkImageGenerationConfig();
  const tool = result?.ok
    ? createArkImageGenerationTool(
      result.config,
      fetch,
      continuationInstructions !== undefined,
    )
    : undefined;
  return {
    enabled: tool !== undefined,
    tools: { ...(tool ? { generate_image: tool } : {}) },
    instructions: tool
      ? [
        IMAGE_GENERATION_INSTRUCTIONS,
        continuationInstructions
          ?? 'Finish image generation before emitting the requested protocol output. Return the complete result in its required format.',
      ].join('\n\n')
      : '',
  };
}
