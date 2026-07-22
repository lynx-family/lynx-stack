// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** Describes a local API that can provide data to an MCP Apps renderer. */
export interface AppApiDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  renderer: string;
}

/** Data required to select and render a locally registered MCP Apps. */
export interface AppRenderData<TResult = unknown> {
  renderer: string;
  input: Record<string, unknown>;
  result: TResult;
}
