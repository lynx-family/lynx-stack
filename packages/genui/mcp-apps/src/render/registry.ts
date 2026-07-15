// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { readAppRenderData } from './data.js';
import type { AppRenderer, ResolvedAppRenderData } from './define.js';

/** A local renderer lookup used by the protocol-agnostic MCP Apps host. */
export interface AppRendererRegistry {
  getRenderer: (id: string) => AppRenderer | null;
  resolveRenderData: (value: unknown) => ResolvedAppRenderData | null;
}

/** Creates an immutable lookup facade for locally supplied renderers. */
export function createAppRendererRegistry(
  renderers: readonly AppRenderer[],
): AppRendererRegistry {
  const rendererById = new Map<string, AppRenderer>();
  for (const renderer of renderers) {
    if (rendererById.has(renderer.id)) {
      throw new Error(`Duplicate MCP Apps renderer id: ${renderer.id}`);
    }
    rendererById.set(renderer.id, renderer);
  }

  const getRenderer = (id: string): AppRenderer | null =>
    rendererById.get(id) ?? null;

  return {
    getRenderer,
    resolveRenderData(value: unknown): ResolvedAppRenderData | null {
      const data = readAppRenderData(value);
      if (!data) return null;
      const renderer = getRenderer(data.renderer);
      if (!renderer) return null;
      const result = renderer.parseResult(data.result);
      if (result === null) return null;
      return { renderer, input: data.input, result };
    },
  };
}
