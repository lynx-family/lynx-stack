// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ComponentType } from '@lynx-js/react';

/** Props supplied by the MCP Apps host to a registered renderer. */
export interface AppRendererProps<TResult = unknown> {
  input: Record<string, unknown>;
  result: TResult;
}

/** Strongly typed definition accepted by {@link defineAppRenderer}. */
export interface AppRendererDefinition<TResult> {
  id: string;
  parseResult: (value: unknown) => TResult | null;
  component: ComponentType<AppRendererProps<TResult>>;
  invalidResultMessage: string;
}

/** Type-erased renderer stored in an MCP Apps renderer registry. */
export interface AppRenderer {
  id: string;
  parseResult: (value: unknown) => unknown;
  component: ComponentType<AppRendererProps>;
  invalidResultMessage: string;
}

/** Validated render data paired with its locally registered renderer. */
export interface ResolvedAppRenderData {
  renderer: AppRenderer;
  input: Record<string, unknown>;
  result: unknown;
}

/**
 * Defines a renderer while preserving its result type at the declaration site.
 */
export function defineAppRenderer<TResult>(
  definition: AppRendererDefinition<TResult>,
): AppRenderer {
  return {
    id: definition.id,
    parseResult: definition.parseResult,
    component: definition.component as unknown as ComponentType<
      AppRendererProps
    >,
    invalidResultMessage: definition.invalidResultMessage,
  };
}
